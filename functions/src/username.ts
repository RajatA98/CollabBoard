import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function validateUsernameFormat(username: string): string | null {
  if (typeof username !== "string") return "Username must be a string";
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 20) return "Username must be at most 20 characters";
  if (!USERNAME_REGEX.test(username)) {
    return "Username can only contain lowercase letters, numbers, and underscores";
  }
  return null;
}

export const claimUsername = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const {username} = request.data as {username?: string};
  if (!username) {
    throw new HttpsError("invalid-argument", "username is required");
  }

  const formatError = validateUsernameFormat(username);
  if (formatError) {
    throw new HttpsError("invalid-argument", formatError);
  }

  const db = admin.firestore();
  const uid = request.auth.uid;

  const usernameRef = db.doc(`usernames/${username}`);
  const userRef = db.doc(`users/${uid}`);

  const usernameSnap = await usernameRef.get();
  if (usernameSnap.exists) {
    const existingUid = usernameSnap.data()?.uid;
    if (existingUid !== uid) {
      throw new HttpsError("already-exists", "Username is already taken");
    }
    return {success: true, username};
  }

  const userSnap = await userRef.get();
  const oldUsername = userSnap.exists ? userSnap.data()?.username : undefined;

  const batch = db.batch();

  batch.set(usernameRef, {uid});
  batch.update(userRef, {
    username,
    updatedAt: Date.now(),
  });

  if (oldUsername && oldUsername !== username) {
    batch.delete(db.doc(`usernames/${oldUsername}`));
  }

  await batch.commit();

  return {success: true, username};
});

export const checkUsernameAvailable = onCall(async (request) => {
  const {username} = request.data as {username?: string};
  if (!username) {
    throw new HttpsError("invalid-argument", "username is required");
  }

  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return {available: false, reason: formatError};
  }

  const db = admin.firestore();
  const usernameSnap = await db.doc(`usernames/${username}`).get();

  return {available: !usernameSnap.exists};
});
