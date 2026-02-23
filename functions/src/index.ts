import {config as loadEnv} from "dotenv";
import path from "path";
import crypto from "crypto";
import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions";
import {defineSecret, defineString} from "firebase-functions/params";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {runAgent} from "./lib/agentRunner.js";

// Re-export Stripe functions
export {createCheckoutSession} from "./stripe/createCheckoutSession.js";
export {createPortalSession} from "./stripe/createPortalSession.js";
export {stripeWebhook} from "./stripe/webhookHandler.js";

// Load .env from repo root when running locally (emulator or Docker). Never throw so Cloud Run can start.
try {
  const cwd = process.cwd();
  loadEnv({path: path.join(cwd, ".env")});
  if (!process.env.ANTHROPIC_API_KEY) {
    loadEnv({path: path.join(cwd, "..", ".env")});
  }
  // When emulator runs from functions/, Stripe keys may be in repo root .env only
  if (!process.env.STRIPE_SECRET_KEY) {
    loadEnv({path: path.join(cwd, "..", ".env")});
  }
} catch {
  // Ignore; production uses Secret Manager, not .env
}

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

const rtdb = admin.database();

// Production: set in Secret Manager so deployed function has Langfuse + Anthropic keys
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const langfuseSecretKey = defineSecret("LANGFUSE_SECRET_KEY");
const langfusePublicKey = defineSecret("LANGFUSE_PUBLIC_KEY");
const langfuseBaseUrl = defineString("LANGFUSE_BASE_URL", {
  default: "https://us.cloud.langfuse.com",
});
const aiModel = defineString("AI_MODEL", {
  default: "claude-sonnet-4-6",
});

export const aiCommand = onCall(
  {
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [anthropicApiKey, langfuseSecretKey, langfusePublicKey],
  },
  async (request) => {
    // In production, env is not from .env; inject from params so Langfuse + Anthropic work
    if (anthropicApiKey.value()) {
      process.env.ANTHROPIC_API_KEY = anthropicApiKey.value();
      process.env.LANGFUSE_SECRET_KEY = langfuseSecretKey.value();
      process.env.LANGFUSE_PUBLIC_KEY = langfusePublicKey.value();
      process.env.LANGFUSE_BASE_URL = langfuseBaseUrl.value();
    }
    if (aiModel.value()) {
      process.env.AI_MODEL = aiModel.value();
    }

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    // --- Subscription usage guard ---
    const firestore = admin.firestore();
    const userDocRef = firestore.doc(`users/${request.auth.uid}`);
    const userSnap = await userDocRef.get();
    let userData: Record<string, unknown> | null = userSnap.exists ? (userSnap.data() ?? null) : null;

    // Ensure user doc exists so free-tier reset/increment don't fail (fixes "internal error" on first AI command)
    if (!userSnap.exists) {
      const now = Date.now();
      const email = (request.auth.token.email as string) ?? "";
      const displayName = (request.auth.token.name as string) ?? "";
      await userDocRef.set({
        email,
        displayName,
        subscriptionTier: "free",
        aiCommandCount: 0,
        lastResetAt: now,
        createdAt: now,
      });
      userData = {
        subscriptionTier: "free",
        aiCommandCount: 0,
        lastResetAt: now,
      };
    }

    const tier = (userData?.subscriptionTier as string) || "free";
    // Admins (custom claim admin: true) get Pro-style access without paying
    const isAdmin = request.auth.token.admin === true;
    const effectiveTier = isAdmin ? "pro" : tier;

    if (effectiveTier === "free") {
      let count = (userData?.aiCommandCount as number) || 0;
      const lastReset = (userData?.lastResetAt as number) || 0;

      // Daily reset: if lastResetAt is before today's midnight UTC, reset the count
      const now = new Date();
      const todayMidnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      ).getTime();

      if (lastReset < todayMidnight) {
        count = 0;
        await userDocRef.update({
          aiCommandCount: 0,
          lastResetAt: Date.now(),
        });
      }

      if (count >= 3) {
        throw new HttpsError(
          "permission-denied",
          "UPGRADE_REQUIRED: You've used all 3 free AI commands for today. Upgrade to Pro for unlimited access."
        );
      }
    }
    // --- End usage guard ---

    const {command, commands, boardId, commandId: clientCommandId, imageBase64, imageMediaType, history} = request.data as {
      command?: string;
      commands?: string[];
      boardId?: string;
      commandId?: string;
      imageBase64?: string;
      imageMediaType?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!boardId) {
      throw new HttpsError(
        "invalid-argument",
        "boardId is required"
      );
    }

    // Support multiple commands sequentially (Cursor-style): run agent once per command, chaining history
    const commandList: string[] = Array.isArray(commands) && commands.length > 0
      ? commands.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean)
      : [];

    const hasImage = typeof imageBase64 === "string" && typeof imageMediaType === "string" && imageBase64.length > 0;
    const singleCommand = typeof command === "string" ? command.trim() : "";
    const hasSingle = singleCommand.length > 0;

    if (commandList.length === 0 && !hasSingle && !hasImage) {
      throw new HttpsError(
        "invalid-argument",
        "command, commands array, or image is required"
      );
    }

    // If no explicit list, treat as one "command" (single message or image-only)
    const toRun = commandList.length > 0
      ? commandList
      : [singleCommand || (hasImage ? "What do you see in this image? Describe or create shapes based on it." : "")];

    // Per-command tracking — each command gets its own entry so multiple can run concurrently
    const commandId = (typeof clientCommandId === "string" && clientCommandId.length > 0)
      ? clientCommandId
      : crypto.randomUUID();
    const commandRef = rtdb.ref(`boards/${boardId}/aiCommands/${commandId}`);
    const commandLabel = toRun.length > 1 ? `${toRun.length} commands` : (toRun[0] || (hasImage ? "(image)" : ""));
    await commandRef.set({
      userId: request.auth.uid,
      command: commandLabel,
      status: "processing",
      startedAt: Date.now(),
    });


    const checkCancel = async (): Promise<boolean> => {
      const snap = await commandRef.child("cancel").get();
      return snap.exists() && Boolean(snap.val());
    };

    try {
      let accumulatedHistory: Array<{ role: "user" | "assistant"; content: string }> = Array.isArray(history) ? [...history] : [];
      const allToolsExecuted: string[] = [];
      const allObjectsCreated: string[] = [];
      let lastReply = "";
      let totalIterations = 0;
      let cancelled = false;

      for (let i = 0; i < toRun.length; i++) {
        if (await checkCancel()) {
          cancelled = true;
          break;
        }
        const cmd = toRun[i];
        const isFirst = i === 0;
        const result = await runAgent({
          command: cmd,
          boardId,
          userId: request.auth.uid,
          checkCancel,
          image: isFirst && hasImage ? {base64: imageBase64 as string, mediaType: imageMediaType as string} : undefined,
          history: accumulatedHistory.length > 0 ? accumulatedHistory : undefined,
        });

        if (result.cancelled) {
          cancelled = true;
          break;
        }

        allToolsExecuted.push(...result.toolsExecuted);
        allObjectsCreated.push(...result.objectsCreated);
        totalIterations += result.iterations;
        lastReply = result.reply ?? "";

        // Chain history for next command: prior turns + this user message + this assistant reply
        accumulatedHistory = [
          ...accumulatedHistory,
          {role: "user" as const, content: cmd},
          {role: "assistant" as const, content: result.reply ?? (result.objectsCreated.length > 0 ? `Created ${result.objectsCreated.length} object(s).` : "Done.")},
        ];
      }

      // Increment AI command count for free-tier users after successful execution
      if (effectiveTier === "free" && !cancelled) {
        await userDocRef.update({
          aiCommandCount: admin.firestore.FieldValue.increment(1),
        });
      }

      return {
        success: !cancelled,
        cancelled: cancelled || undefined,
        reply: lastReply,
        toolsExecuted: allToolsExecuted,
        objectsCreated: allObjectsCreated,
        iterations: totalIterations,
        commandId,
      };
    } finally {
      await commandRef.remove();
    }
  }
);
