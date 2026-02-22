import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";

export const inviteCollaborator = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const {boardId, targetUid, role} = request.data as {
    boardId?: string;
    targetUid?: string;
    role?: "editor" | "viewer";
  };
  if (!boardId || !targetUid || !role) {
    throw new HttpsError("invalid-argument", "boardId, targetUid, and role are required");
  }
  if (role !== "editor" && role !== "viewer") {
    throw new HttpsError("invalid-argument", "role must be 'editor' or 'viewer'");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const boardRef = db.doc(`boardMeta/${boardId}`);
  const boardSnap = await boardRef.get();
  if (!boardSnap.exists) {
    throw new HttpsError("not-found", "Board not found");
  }

  const boardData = boardSnap.data()!;
  if (boardData.creatorId !== uid) {
    throw new HttpsError("permission-denied", "Only the board owner can invite collaborators");
  }

  if (targetUid === uid) {
    throw new HttpsError("invalid-argument", "Cannot invite yourself");
  }

  const existingCollabs = boardData.collaborators || {};
  if (existingCollabs[targetUid]?.status === "accepted") {
    throw new HttpsError("already-exists", "User is already a collaborator");
  }

  const inviterSnap = await db.doc(`users/${uid}`).get();
  const inviterData = inviterSnap.exists ? inviterSnap.data()! : {};

  const now = Date.now();
  const batch = db.batch();

  batch.update(boardRef, {
    [`collaborators.${targetUid}`]: {
      role,
      status: "pending",
      invitedAt: now,
      invitedBy: uid,
    },
  });

  const invitationRef = db.doc(`users/${targetUid}/invitations/${boardId}`);
  batch.set(invitationRef, {
    boardId,
    boardName: boardData.name || "Untitled",
    invitedBy: uid,
    invitedByName: inviterData.displayName || "",
    invitedByUsername: inviterData.username || "",
    invitedByAvatarColor: inviterData.avatarColor || "#999",
    role,
    status: "pending",
    createdAt: now,
  });

  await batch.commit();

  return {success: true};
});

export const respondBoardInvitation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const {boardId, action} = request.data as {
    boardId?: string;
    action?: "accept" | "decline";
  };
  if (!boardId || !action) {
    throw new HttpsError("invalid-argument", "boardId and action are required");
  }
  if (action !== "accept" && action !== "decline") {
    throw new HttpsError("invalid-argument", "action must be 'accept' or 'decline'");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const invitationRef = db.doc(`users/${uid}/invitations/${boardId}`);
  const invSnap = await invitationRef.get();
  if (!invSnap.exists || invSnap.data()?.status !== "pending") {
    throw new HttpsError("not-found", "No pending invitation for this board");
  }

  const boardRef = db.doc(`boardMeta/${boardId}`);
  const batch = db.batch();

  if (action === "accept") {
    batch.update(invitationRef, {status: "accepted"});
    batch.update(boardRef, {
      [`collaborators.${uid}.status`]: "accepted",
      collaboratorUids: admin.firestore.FieldValue.arrayUnion(uid),
    });
  } else {
    batch.update(invitationRef, {status: "declined"});
    batch.update(boardRef, {
      [`collaborators.${uid}`]: admin.firestore.FieldValue.delete(),
    });
  }

  await batch.commit();

  return {success: true};
});

export const removeCollaborator = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const {boardId, targetUid} = request.data as {
    boardId?: string;
    targetUid?: string;
  };
  if (!boardId || !targetUid) {
    throw new HttpsError("invalid-argument", "boardId and targetUid are required");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  const boardRef = db.doc(`boardMeta/${boardId}`);
  const boardSnap = await boardRef.get();
  if (!boardSnap.exists) {
    throw new HttpsError("not-found", "Board not found");
  }

  if (boardSnap.data()!.creatorId !== uid) {
    throw new HttpsError("permission-denied", "Only the board owner can remove collaborators");
  }

  const batch = db.batch();

  batch.update(boardRef, {
    [`collaborators.${targetUid}`]: admin.firestore.FieldValue.delete(),
    collaboratorUids: admin.firestore.FieldValue.arrayRemove(targetUid),
  });

  const invitationRef = db.doc(`users/${targetUid}/invitations/${boardId}`);
  const invSnap = await invitationRef.get();
  if (invSnap.exists) {
    batch.delete(invitationRef);
  }

  await batch.commit();

  return {success: true};
});
