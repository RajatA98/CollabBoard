import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { clearObjects } from './firestore';
import type { BoardMeta } from '../types';

export async function createBoard(
  name: string,
  creatorId: string,
  creatorName: string,
  visibility: 'open' | 'private' = 'private'
): Promise<BoardMeta> {
  const id = doc(collection(db, 'boardMeta')).id;
  const board: BoardMeta = {
    id,
    name,
    creatorId,
    creatorName,
    members: [creatorId],
    memberNames: { [creatorId]: creatorName },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    visibility,
    collaborators: {},
    collaboratorUids: [creatorId],
  };
  const ref = doc(db, 'boardMeta', id);
  await setDoc(ref, {
    ...board,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return board;
}

export async function joinBoard(
  boardId: string,
  userId: string,
  displayName: string
): Promise<void> {
  const ref = doc(db, 'boardMeta', boardId);
  await updateDoc(ref, {
    members: arrayUnion(userId),
    [`memberNames.${userId}`]: displayName,
    updatedAt: serverTimestamp(),
  });
}

export async function leaveBoard(
  boardId: string,
  userId: string
): Promise<void> {
  const ref = doc(db, 'boardMeta', boardId);
  await updateDoc(ref, {
    members: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function getBoardMeta(
  boardId: string
): Promise<BoardMeta | null> {
  const ref = doc(db, 'boardMeta', boardId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as BoardMeta;
}

export async function updateBoardName(
  boardId: string,
  name: string
): Promise<void> {
  const ref = doc(db, 'boardMeta', boardId);
  await updateDoc(ref, {
    name: name.trim() || '',
    updatedAt: serverTimestamp(),
  });
}

export async function updateBoardVisibility(
  boardId: string,
  visibility: 'open' | 'private'
): Promise<void> {
  const ref = doc(db, 'boardMeta', boardId);
  await updateDoc(ref, {
    visibility,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a board: removes all board objects then the board meta document.
 * Firestore rules allow delete only when request.auth.uid === resource.data.creatorId.
 */
export async function deleteBoard(boardId: string): Promise<void> {
  await clearObjects(boardId);
  const ref = doc(db, 'boardMeta', boardId);
  await deleteDoc(ref);
}

export function onBoardMetaChange(
  boardId: string,
  callback: (meta: BoardMeta | null) => void
): () => void {
  const ref = doc(db, 'boardMeta', boardId);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ ...snapshot.data(), id: snapshot.id } as BoardMeta);
  });
}

export function onMyBoardsChange(
  userId: string,
  callback: (boards: BoardMeta[]) => void
): () => void {
  // Query boards where user is a member (joined via "Join Board" flow)
  const membersQuery = query(
    collection(db, 'boardMeta'),
    where('members', 'array-contains', userId)
  );

  // Query boards where user is an accepted collaborator (invited)
  const collabQuery = query(
    collection(db, 'boardMeta'),
    where('collaboratorUids', 'array-contains', userId)
  );

  const boardMap = new Map<string, BoardMeta>();
  let membersLoaded = false;
  let collabLoaded = false;

  const mergeFn = () => {
    if (membersLoaded && collabLoaded) {
      callback(Array.from(boardMap.values()));
    }
  };

  const unsub1 = onSnapshot(membersQuery, (snapshot) => {
    for (const d of snapshot.docs) {
      boardMap.set(d.id, { ...d.data(), id: d.id } as BoardMeta);
    }
    membersLoaded = true;
    mergeFn();
  });

  const unsub2 = onSnapshot(collabQuery, (snapshot) => {
    for (const d of snapshot.docs) {
      boardMap.set(d.id, { ...d.data(), id: d.id } as BoardMeta);
    }
    collabLoaded = true;
    mergeFn();
  });

  return () => {
    unsub1();
    unsub2();
  };
}

export function onOpenBoardsChange(
  callback: (boards: BoardMeta[]) => void
): () => void {
  const q = query(
    collection(db, 'boardMeta'),
    where('visibility', '==', 'open')
  );
  return onSnapshot(q, (snapshot) => {
    const boards = snapshot.docs.map(
      (d) => ({ ...d.data(), id: d.id }) as BoardMeta
    );
    callback(boards);
  });
}
