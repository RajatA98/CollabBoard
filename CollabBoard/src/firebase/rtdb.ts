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
  try {
    await set(cursorRef, data);
  } catch (error) {
    console.error('❌ Firebase RTDB: Failed to set cursor:', error);
    throw error;
  }
}

export async function removeCursor(boardId: string, userId: string) {
  const cursorRef = getCursorRef(boardId, userId);
  await remove(cursorRef);
}

export async function setPresence(boardId: string, userId: string, data: PresenceData) {
  const presenceRef = getPresenceRef(boardId, userId);
  try {
    await set(presenceRef, data);
  } catch (error) {
    console.error('❌ Firebase RTDB: Failed to set presence:', error);
    throw error;
  }
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
  const unsubscribe = onValue(
    cursorsRef,
    (snapshot) => {
      callback(snapshot.val() ?? {});
    },
    (error) => {
      console.error('❌ Firebase RTDB: Error listening to cursors:', error);
      console.error('❌ This might be a permissions issue. Check Firebase RTDB rules.');
    }
  );
  return unsubscribe;
}

export function onPresenceChange(
  boardId: string,
  callback: (presence: Record<string, PresenceData>) => void
): () => void {
  const allRef = getAllPresenceRef(boardId);
  const unsubscribe = onValue(
    allRef,
    (snapshot) => {
      callback(snapshot.val() ?? {});
    },
    (error) => {
      console.error('❌ Firebase RTDB: Error listening to presence:', error);
      console.error('❌ This might be a permissions issue. Check Firebase RTDB rules.');
    }
  );
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

export async function cleanupUserData(boardId: string, userId: string) {
  console.log('🧹 Cleaning up user data for logout:', { boardId, userId });
  await Promise.all([
    removePresence(boardId, userId),
    removeCursor(boardId, userId),
  ]);
  console.log('✅ User data cleaned up successfully');
}
