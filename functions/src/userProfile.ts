import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

const AVATAR_COLORS = [
  "#FF6B6B", "#51CF66", "#339AF0", "#CC5DE8",
  "#FF922B", "#20C997", "#F06595",
];

function hashColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const ensureUserProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    const data = userSnap.data()!;
    const updates: Record<string, unknown> = {};

    if (request.auth.token.email && data.email !== request.auth.token.email) {
      updates.email = request.auth.token.email;
    }
    if (request.auth.token.name && data.displayName !== request.auth.token.name) {
      updates.displayName = request.auth.token.name;
      updates.displayNameLower = (request.auth.token.name as string).toLowerCase();
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Date.now();
      await userRef.update(updates);
    }

    return {success: true, created: false};
  }

  const displayName = request.auth.token.name || request.auth.token.email || "";
  const now = Date.now();

  await userRef.set({
    uid,
    email: request.auth.token.email || "",
    displayName,
    displayNameLower: displayName.toLowerCase(),
    avatarColor: hashColor(uid),
    createdAt: now,
    updatedAt: now,
  });

  return {success: true, created: true};
});
