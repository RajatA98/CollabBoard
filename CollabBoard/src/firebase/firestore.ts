import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
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
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteObject(boardId: string, objectId: string) {
  const ref = doc(db, 'boards', boardId, 'objects', objectId);
  await deleteDoc(ref);
}
