import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

async function getUserInfo(db: admin.firestore.Firestore, uid: string) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `User ${uid} not found`);
  }
  const data = snap.data()!;
  return {
    displayName: data.displayName || "",
    username: data.username || "",
    avatarColor: data.avatarColor || "#999",
    avatarUrl: data.avatarUrl || null,
  };
}

export const sendFriendRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const {targetUid} = request.data as {targetUid?: string};
  if (!targetUid) {
    throw new HttpsError("invalid-argument", "targetUid is required");
  }

  const senderUid = request.auth.uid;
  if (senderUid === targetUid) {
    throw new HttpsError("invalid-argument", "Cannot send friend request to yourself");
  }

  const db = admin.firestore();

  const existingRef = db.doc(`users/${senderUid}/friends/${targetUid}`);
  const existingSnap = await existingRef.get();
  if (existingSnap.exists) {
    const status = existingSnap.data()?.status;
    if (status === "accepted") {
      throw new HttpsError("already-exists", "Already friends");
    }
    if (status === "pending_sent") {
      throw new HttpsError("already-exists", "Friend request already sent");
    }
    if (status === "pending_received") {
      throw new HttpsError("already-exists", "This user already sent you a request. Check your requests.");
    }
  }

  const [senderInfo, targetInfo] = await Promise.all([
    getUserInfo(db, senderUid),
    getUserInfo(db, targetUid),
  ]);

  const now = Date.now();
  const batch = db.batch();

  batch.set(db.doc(`users/${senderUid}/friends/${targetUid}`), {
    status: "pending_sent",
    since: now,
    displayName: targetInfo.displayName,
    username: targetInfo.username,
    avatarUrl: targetInfo.avatarUrl,
    avatarColor: targetInfo.avatarColor,
  });

  batch.set(db.doc(`users/${targetUid}/friends/${senderUid}`), {
    status: "pending_received",
    since: now,
    displayName: senderInfo.displayName,
    username: senderInfo.username,
    avatarUrl: senderInfo.avatarUrl,
    avatarColor: senderInfo.avatarColor,
  });

  await batch.commit();

  return {success: true};
});

export const respondFriendRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const {friendUid, action} = request.data as {
    friendUid?: string;
    action?: "accept" | "decline";
  };
  if (!friendUid || !action) {
    throw new HttpsError("invalid-argument", "friendUid and action are required");
  }
  if (action !== "accept" && action !== "decline") {
    throw new HttpsError("invalid-argument", "action must be 'accept' or 'decline'");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const myRef = db.doc(`users/${uid}/friends/${friendUid}`);
  const mySnap = await myRef.get();
  if (!mySnap.exists || mySnap.data()?.status !== "pending_received") {
    throw new HttpsError("not-found", "No pending friend request from this user");
  }

  const theirRef = db.doc(`users/${friendUid}/friends/${uid}`);
  const batch = db.batch();

  if (action === "accept") {
    const now = Date.now();
    batch.update(myRef, {status: "accepted", since: now});
    batch.update(theirRef, {status: "accepted", since: now});
  } else {
    batch.delete(myRef);
    batch.delete(theirRef);
  }

  await batch.commit();

  return {success: true};
});

export const removeFriend = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const {friendUid} = request.data as {friendUid?: string};
  if (!friendUid) {
    throw new HttpsError("invalid-argument", "friendUid is required");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const batch = db.batch();

  batch.delete(db.doc(`users/${uid}/friends/${friendUid}`));
  batch.delete(db.doc(`users/${friendUid}/friends/${uid}`));

  await batch.commit();

  return {success: true};
});
