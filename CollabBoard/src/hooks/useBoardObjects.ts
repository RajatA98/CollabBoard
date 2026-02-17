import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  addObject as fbAddObject,
  updateObject as fbUpdateObject,
  deleteObject as fbDeleteObject,
  clearObjects as fbClearObjects,
} from '../firebase/firestore';
import type { BoardObject } from '../types';

export function useBoardObjects(boardId: string) {
  const [objects, setObjects] = useState<BoardObject[]>([]);

  useEffect(() => {
    console.log('📡 Setting up Firestore listener for board:', boardId);
    const colRef = collection(db, 'boards', boardId, 'objects');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as BoardObject[];
      console.log('🔄 Firestore snapshot received:', { count: docs.length, docs });
      setObjects(docs);
    });
    return unsubscribe;
  }, [boardId]);

  const addObject = useCallback(
    async (object: BoardObject) => {
      console.log('💾 useBoardObjects.addObject called with:', { boardId, object });
      try {
        await fbAddObject(boardId, object);
        console.log('✅ fbAddObject completed successfully');
      } catch (error) {
        console.error('❌ fbAddObject failed:', error);
        throw error;
      }
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

  const clearObjects = useCallback(async () => {
    await fbClearObjects(boardId);
  }, [boardId]);

  return { objects, addObject, updateObject, deleteObject, clearObjects };
}
