import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {runAgent} from "./lib/agentRunner.js";

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

const rtdb = admin.database();

export const aiCommand = onCall(
  {timeoutSeconds: 120, memory: "512MiB"},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const {command, boardId} = request.data as {
      command?: string;
      boardId?: string;
    };

    if (!command || !boardId) {
      throw new HttpsError(
        "invalid-argument",
        "command and boardId are required"
      );
    }

    // AI lock — prevent concurrent agent runs on the same board
    const lockRef = rtdb.ref(`boards/${boardId}/aiLock`);
    const lockSnap = await lockRef.get();

    if (lockSnap.exists()) {
      const lock = lockSnap.val() as {startedAt: number};
      if (Date.now() - lock.startedAt < 30000) {
        throw new HttpsError(
          "resource-exhausted",
          "AI is already processing a command for this board"
        );
      }
    }

    await lockRef.set({
      userId: request.auth.uid,
      command,
      startedAt: Date.now(),
    });

    try {
      const result = await runAgent({
        command,
        boardId,
        userId: request.auth.uid,
      });
      return result;
    } finally {
      await lockRef.remove();
    }
  }
);
