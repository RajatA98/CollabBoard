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

/** Firestore does not support NaN/Infinity; sanitize numeric fields to avoid write errors and corrupt data. */
function sanitizePayload(updates: Partial<BoardObject>): Record<string, unknown> {
  const numericKeys = new Set([
    'x', 'y', 'width', 'height', 'rotation', 'createdAt', 'updatedAt',
    'fontSize', 'strokeWidth', 'aspectRatio',
  ]);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      payload[key] = deleteField();
    } else if (numericKeys.has(key) && typeof value === 'number' && !Number.isFinite(value)) {
      // Skip non-finite numbers so we don't write NaN/Infinity to Firestore
      continue;
    } else if (key === 'waypoints' && Array.isArray(value)) {
      payload[key] = value.map((w: { x?: number; y?: number }) => ({
        x: Number.isFinite(w.x) ? w.x : 0,
        y: Number.isFinite(w.y) ? w.y : 0,
      }));
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

export async function addObject(boardId: string, object: BoardObject) {
  console.log('🔥 Firebase addObject called:', { boardId, objectId: object.id });
  const ref = doc(db, 'boards', boardId, 'objects', object.id);
  const safe = {
    ...object,
    x: Number.isFinite(object.x) ? object.x : 0,
    y: Number.isFinite(object.y) ? object.y : 0,
    width: Number.isFinite(object.width) && object.width > 0 ? object.width : 100,
    height: Number.isFinite(object.height) && object.height > 0 ? object.height : 100,
    rotation: Number.isFinite(object.rotation) ? object.rotation : 0,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  try {
    await setDoc(ref, safe);
    console.log('✅ Firebase setDoc completed for:', object.id);
  } catch (error) {
    console.error('❌ Firebase setDoc failed:', error);
    throw error;
  }
}

export async function updateObject(boardId: string, objectId: string, updates: Partial<BoardObject>) {
  const ref = doc(db, 'boards', boardId, 'objects', objectId);
  const payload = sanitizePayload(updates);
  await updateDoc(ref, payload);
}

/** Update multiple objects in a single batch (one round-trip, one snapshot). Use for frame + children to reduce lag. */
export async function updateObjectsBatch(
  boardId: string,
  updates: Array<{ objectId: string; updates: Partial<BoardObject> }>
) {
  if (updates.length === 0) return;
  const batch = writeBatch(db);
  for (const { objectId, updates: ups } of updates) {
    const ref = doc(db, 'boards', boardId, 'objects', objectId);
    const payload = sanitizePayload(ups);
    batch.update(ref, payload);
  }
  await batch.commit();
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
