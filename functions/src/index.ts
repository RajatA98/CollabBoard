import {config as loadEnv} from "dotenv";
import path from "path";
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
    const userData = userSnap.exists ? userSnap.data()! : null;
    const tier = (userData?.subscriptionTier as string) || "free";

    if (tier === "free") {
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

    const {command, commands, boardId, imageBase64, imageMediaType, history} = request.data as {
      command?: string;
      commands?: string[];
      boardId?: string;
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

    // AI lock — prevent concurrent agent runs on the same board
    const lockRef = rtdb.ref(`boards/${boardId}/aiLock`);
    const lockSnap = await lockRef.get();

    if (lockSnap.exists()) {
      const lock = lockSnap.val() as {startedAt: number};
      if (Date.now() - lock.startedAt < 30000) {
        throw new HttpsError(
          "resource-exhausted",
          "AI is already processing a command for this board. Please wait."
        );
      }
    }

    const lockLabel = toRun.length > 1 ? `${toRun.length} commands` : (toRun[0] || (hasImage ? "(image)" : ""));
    await lockRef.set({
      userId: request.auth.uid,
      command: lockLabel,
      startedAt: Date.now(),
    });

    const cancelRef = rtdb.ref(`boards/${boardId}/aiCancel`);
    await cancelRef.remove();

    const checkCancel = async (): Promise<boolean> => {
      const snap = await cancelRef.get();
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
          await lockRef.remove();
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
          await lockRef.remove();
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
      if (tier === "free" && !cancelled) {
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
      };
    } finally {
      await lockRef.remove();
      await cancelRef.remove();
    }
  }
);
