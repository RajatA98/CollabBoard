import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { BoardObject } from '../types';

export async function addObject(boardId: string, object: BoardObject) {
  console.log('🔥 Firebase addObject called:', { boardId, objectId: object.id });
  const ref = doc(db, 'boards', boardId, 'objects', object.id);
  try {
    await setDoc(ref, {
      ...object,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    console.log('✅ Firebase setDoc completed for:', object.id);
  } catch (error) {
    console.error('❌ Firebase setDoc failed:', error);
    throw error;
  }
}

export async function updateObject(boardId: string, objectId: string, updates: Partial<BoardObject>) {
  const ref = doc(db, 'boards', boardId, 'objects', objectId);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      payload[key] = deleteField();
    } else {
      payload[key] = value;
    }
  }
  await updateDoc(ref, payload);
}

export async function deleteObject(boardId: string, objectId: string) {
  const ref = doc(db, 'boards', boardId, 'objects', objectId);
  await deleteDoc(ref);
}

/**
 * Deletes all objects for a board.
 *
 * Note: Firestore batch writes are limited to 500 operations; we commit in chunks.
 */
export async function clearObjects(boardId: string) {
  const colRef = collection(db, 'boards', boardId, 'objects');
  const snap = await getDocs(colRef);

  // Firestore batch limit is 500; use a lower chunk size for safety.
  const CHUNK_SIZE = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    const chunk = snap.docs.slice(i, i + CHUNK_SIZE);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}
