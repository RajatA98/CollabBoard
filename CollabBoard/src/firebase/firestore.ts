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
  const ref = doc(db, 'boards', boardId, 'objects', object.id);
  await setDoc(ref, {
    ...object,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
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
