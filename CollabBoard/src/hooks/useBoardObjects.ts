import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  addObject as fbAddObject,
  updateObject as fbUpdateObject,
  deleteObject as fbDeleteObject,
} from '../firebase/firestore';
import type { BoardObject } from '../types';

export function useBoardObjects(boardId: string) {
  const [objects, setObjects] = useState<BoardObject[]>([]);

  useEffect(() => {
    const colRef = collection(db, 'boards', boardId, 'objects');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as BoardObject[];
      setObjects(docs);
    });
    return unsubscribe;
  }, [boardId]);

  const addObject = useCallback(
    async (object: BoardObject) => {
      await fbAddObject(boardId, object);
    },
    [boardId]
  );

  const updateObject = useCallback(
    async (objectId: string, updates: Partial<BoardObject>) => {
      await fbUpdateObject(boardId, objectId, updates);
    },
    [boardId]
  );

  const deleteObject = useCallback(
    async (objectId: string) => {
      await fbDeleteObject(boardId, objectId);
    },
    [boardId]
  );

  return { objects, addObject, updateObject, deleteObject };
}
