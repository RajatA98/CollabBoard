import { ref, set, onValue, onDisconnect, remove } from 'firebase/database';
import { rtdb } from './config';
import type { CursorData, PresenceData } from '../types';

export function getCursorRef(boardId: string, userId: string) {
  return ref(rtdb, `boards/${boardId}/cursors/${userId}`);
}

export function getCursorsRef(boardId: string) {
  return ref(rtdb, `boards/${boardId}/cursors`);
}

export function getPresenceRef(boardId: string, userId: string) {
  return ref(rtdb, `boards/${boardId}/presence/${userId}`);
}

export function getAllPresenceRef(boardId: string) {
  return ref(rtdb, `boards/${boardId}/presence`);
}

export async function setCursor(boardId: string, userId: string, data: CursorData) {
  const cursorRef = getCursorRef(boardId, userId);
  await set(cursorRef, data);
}

export async function removeCursor(boardId: string, userId: string) {
  const cursorRef = getCursorRef(boardId, userId);
  await remove(cursorRef);
}

export async function setPresence(boardId: string, userId: string, data: PresenceData) {
  const presenceRef = getPresenceRef(boardId, userId);
  await set(presenceRef, data);
}

export async function removePresence(boardId: string, userId: string) {
  const presenceRef = getPresenceRef(boardId, userId);
  await remove(presenceRef);
}

export function onCursorsChange(
  boardId: string,
  callback: (cursors: Record<string, CursorData>) => void
): () => void {
  const cursorsRef = getCursorsRef(boardId);
  const unsubscribe = onValue(cursorsRef, (snapshot) => {
    callback(snapshot.val() ?? {});
  });
  return unsubscribe;
}

export function onPresenceChange(
  boardId: string,
  callback: (presence: Record<string, PresenceData>) => void
): () => void {
  const allRef = getAllPresenceRef(boardId);
  const unsubscribe = onValue(allRef, (snapshot) => {
    callback(snapshot.val() ?? {});
  });
  return unsubscribe;
}

export function setupCursorDisconnect(boardId: string, userId: string) {
  const cursorRef = getCursorRef(boardId, userId);
  onDisconnect(cursorRef).remove();
}

export function setupPresenceDisconnect(boardId: string, userId: string) {
  const presenceRef = getPresenceRef(boardId, userId);
  onDisconnect(presenceRef).remove();
}
