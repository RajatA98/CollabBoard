import { ref, set, onValue, onDisconnect, remove } from 'firebase/database';
import { rtdb } from './config';
import type { CursorData, PresenceData, LiveTransformData, LiveEditingData, SelectionData } from '../types';

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

// --- Live Transform operations ---

export function getTransformRef(boardId: string, userId: string) {
  return ref(rtdb, `boards/${boardId}/transforms/${userId}`);
}

export function getTransformsRef(boardId: string) {
  return ref(rtdb, `boards/${boardId}/transforms`);
}

export async function setTransform(boardId: string, userId: string, data: LiveTransformData) {
  const transformRef = getTransformRef(boardId, userId);
  try {
    await set(transformRef, data);
  } catch (error) {
    console.error('Failed to set live transform:', error);
  }
}

export async function removeTransform(boardId: string, userId: string) {
  const transformRef = getTransformRef(boardId, userId);
  await remove(transformRef);
}

export function onTransformsChange(
  boardId: string,
  callback: (transforms: Record<string, LiveTransformData>) => void
): () => void {
  const transformsRef = getTransformsRef(boardId);
  const unsubscribe = onValue(
    transformsRef,
    (snapshot) => {
      callback(snapshot.val() ?? {});
    },
    (error) => {
      console.error('Error listening to live transforms:', error);
    }
  );
  return unsubscribe;
}

export function setupTransformDisconnect(boardId: string, userId: string) {
  const transformRef = getTransformRef(boardId, userId);
  onDisconnect(transformRef).remove();
}

// --- Live Editing operations ---

export function getEditingRef(boardId: string, userId: string) {
  return ref(rtdb, `boards/${boardId}/editing/${userId}`);
}

export function getEditingsRef(boardId: string) {
  return ref(rtdb, `boards/${boardId}/editing`);
}

export async function setEditing(boardId: string, userId: string, data: LiveEditingData) {
  const editingRef = getEditingRef(boardId, userId);
  try {
    await set(editingRef, data);
  } catch (error) {
    console.error('Failed to set live editing:', error);
  }
}

export async function removeEditing(boardId: string, userId: string) {
  const editingRef = getEditingRef(boardId, userId);
  await remove(editingRef);
}

export function onEditingsChange(
  boardId: string,
  callback: (editings: Record<string, LiveEditingData>) => void
): () => void {
  const editingsRef = getEditingsRef(boardId);
  const unsubscribe = onValue(
    editingsRef,
    (snapshot) => {
      callback(snapshot.val() ?? {});
    },
    (error) => {
      console.error('Error listening to live editing:', error);
    }
  );
  return unsubscribe;
}

export function setupEditingDisconnect(boardId: string, userId: string) {
  const editingRef = getEditingRef(boardId, userId);
  onDisconnect(editingRef).remove();
}

// --- Selection operations ---

export function getSelectionRef(boardId: string, userId: string) {
  return ref(rtdb, `boards/${boardId}/selection/${userId}`);
}

export function getSelectionsRef(boardId: string) {
  return ref(rtdb, `boards/${boardId}/selection`);
}

export async function setSelection(boardId: string, userId: string, data: SelectionData) {
  const selectionRef = getSelectionRef(boardId, userId);
  try {
    await set(selectionRef, data);
  } catch (error) {
    console.error('Failed to set selection:', error);
  }
}

export async function removeSelection(boardId: string, userId: string) {
  const selectionRef = getSelectionRef(boardId, userId);
  await remove(selectionRef);
}

export function onSelectionsChange(
  boardId: string,
  callback: (selections: Record<string, SelectionData>) => void
): () => void {
  const selectionsRef = getSelectionsRef(boardId);
  const unsubscribe = onValue(
    selectionsRef,
    (snapshot) => {
      callback(snapshot.val() ?? {});
    },
    (error) => {
      console.error('Error listening to selections:', error);
    }
  );
  return unsubscribe;
}

export function setupSelectionDisconnect(boardId: string, userId: string) {
  const selectionRef = getSelectionRef(boardId, userId);
  onDisconnect(selectionRef).remove();
}

// --- Cleanup ---

export async function cleanupUserData(boardId: string, userId: string) {
  console.log('Cleaning up user data for logout:', { boardId, userId });
  await Promise.all([
    removePresence(boardId, userId),
    removeCursor(boardId, userId),
    removeTransform(boardId, userId),
    removeEditing(boardId, userId),
    removeSelection(boardId, userId),
  ]);
  console.log('User data cleaned up successfully');
}
