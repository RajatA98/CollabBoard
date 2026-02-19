import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  addObject as fbAddObject,
  updateObject as fbUpdateObject,
  deleteObject as fbDeleteObject,
  clearObjects as fbClearObjects,
} from '../firebase/firestore';
import type { BoardObject } from '../types';

const BOARD_OBJECT_TYPES: BoardObject['type'][] = ['sticky', 'rectangle', 'circle', 'line', 'text', 'triangle', 'star', 'frame'];

/** Ensure object has required numeric/string fields so connection points and shapes never get undefined/NaN from Firestore. */
function normalizeBoardObject(raw: Record<string, unknown>, id: string): BoardObject {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
  const rawType = str(raw.type, 'rectangle');
  const type = BOARD_OBJECT_TYPES.includes(rawType as BoardObject['type']) ? (rawType as BoardObject['type']) : 'rectangle';
  return {
    id,
    type,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: num(raw.width, 100),
    height: num(raw.height, 100),
    rotation: num(raw.rotation, 0),
    text: raw.text != null ? str(raw.text, '') : undefined,
    color: str(raw.color, '#e0e0e0'),
    createdBy: str(raw.createdBy, ''),
    createdAt: num(raw.createdAt, 0),
    updatedAt: num(raw.updatedAt, 0),
    updatedBy: str(raw.updatedBy, ''),
    arrowType: raw.arrowType != null ? str(raw.arrowType, 'none') as BoardObject['arrowType'] : undefined,
    waypoints: Array.isArray(raw.waypoints) ? raw.waypoints : undefined,
    fromId: raw.fromId != null ? str(raw.fromId, '') : undefined,
    fromPoint: raw.fromPoint != null ? str(raw.fromPoint, '') : undefined,
    toId: raw.toId != null ? str(raw.toId, '') : undefined,
    toPoint: raw.toPoint != null ? str(raw.toPoint, '') : undefined,
  };
}

export function useBoardObjects(boardId: string) {
  const [objects, setObjects] = useState<BoardObject[]>([]);
  /** IDs of objects currently being dragged — Firestore snapshots must not override their local positions. */
  const draggingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log('📡 Setting up Firestore listener for board:', boardId);
    const colRef = collection(db, 'boards', boardId, 'objects');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const docs = snapshot.docs.map((doc) =>
        normalizeBoardObject({ ...doc.data(), id: doc.id }, doc.id)
      );
      console.log('🔄 Firestore snapshot received:', { count: docs.length, docs });
      setObjects(prev => {
        // Fast path: nothing is being dragged
        if (draggingIdsRef.current.size === 0) return docs;
        // Preserve local state for any object that is mid-drag so Konva nodes
        // don't snap back to stale Firestore coordinates during the gesture.
        return docs.map(doc =>
          draggingIdsRef.current.has(doc.id)
            ? (prev.find(o => o.id === doc.id) ?? doc)
            : doc
        );
      });
    });
    return unsubscribe;
  }, [boardId]);

  const markDragging = useCallback((ids: string[]) => {
    ids.forEach(id => draggingIdsRef.current.add(id));
  }, []);

  const unmarkDragging = useCallback((ids: string[]) => {
    ids.forEach(id => draggingIdsRef.current.delete(id));
  }, []);

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
      // Optimistic update so undo/redo and other updates reflect immediately in the UI
      setObjects((prev) =>
        prev.map((o) => (o.id === objectId ? { ...o, ...updates } : o))
      );
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

  return { objects, addObject, updateObject, deleteObject, clearObjects, markDragging, unmarkDragging };
}
