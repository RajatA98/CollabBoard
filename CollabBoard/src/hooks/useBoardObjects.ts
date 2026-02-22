import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  addObject as fbAddObject,
  updateObject as fbUpdateObject,
  updateObjectsBatch as fbUpdateObjectsBatch,
  deleteObject as fbDeleteObject,
  clearObjects as fbClearObjects,
} from '../firebase/firestore';
import type { BoardObject } from '../types';

const BOARD_OBJECT_TYPES: BoardObject['type'][] = ['sticky', 'rectangle', 'circle', 'line', 'text', 'triangle', 'star', 'frame', 'pen'];

const MIN_SIZE = 20;
const MAX_ROTATION = 360;

/** Sanitize partial updates so we never merge or write NaN/Infinity (fixes white screen from bad rotation/transform). */
function sanitizeUpdates(updates: Partial<BoardObject>, existing?: BoardObject): Partial<BoardObject> {
  const out: Partial<BoardObject> = {};
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      (out as Record<string, unknown>)[key] = undefined;
      continue;
    }
    const fallback = existing ? (existing as unknown as Record<string, unknown>)[key] : undefined;
    const def = typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0;
    if (key === 'x' || key === 'y') {
      (out as Record<string, number>)[key] = num(value, def);
    } else if (key === 'width' || key === 'height') {
      const v = num(value, key === 'width' ? 100 : 100);
      (out as Record<string, number>)[key] = Math.max(MIN_SIZE, v);
    } else if (key === 'rotation') {
      const v = num(value, def);
      (out as Record<string, number>)[key] = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, v));
    } else if (key === 'zIndex') {
      const v = num(value, def);
      if (Number.isFinite(v)) (out as Record<string, number>)[key] = v;
    } else if (key === 'fontSize' || key === 'strokeWidth' || key === 'aspectRatio' || key === 'createdAt' || key === 'updatedAt') {
      const v = num(value, def);
      if (Number.isFinite(v)) (out as Record<string, number>)[key] = v;
    } else if (key === 'waypoints' && Array.isArray(value)) {
      (out as Record<string, unknown>)[key] = value.map((w: { x?: number; y?: number }) => ({
        x: num(w.x, 0),
        y: num(w.y, 0),
      }));
    } else if (key === 'points' && Array.isArray(value)) {
      (out as Record<string, unknown>)[key] = value.filter((v: unknown) => typeof v === 'number' && Number.isFinite(v));
    } else {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

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
    // Optional text/shape styling (preserved from Firestore)
    textColor: raw.textColor != null ? str(raw.textColor, '#333333') : undefined,
    fontSize: raw.fontSize != null ? num(raw.fontSize, 16) : undefined,
    fontFamily: raw.fontFamily != null ? str(raw.fontFamily, '') : undefined,
    bold: raw.bold != null ? !!raw.bold : undefined,
    italic: raw.italic != null ? !!raw.italic : undefined,
    underline: raw.underline != null ? !!raw.underline : undefined,
    strokeColor: raw.strokeColor != null ? str(raw.strokeColor, '#ccc') : undefined,
    strokeWidth: raw.strokeWidth != null ? num(raw.strokeWidth, 1) : undefined,
    lineStyle: raw.lineStyle != null && ['solid', 'dashed', 'dotted'].includes(String(raw.lineStyle))
      ? (raw.lineStyle as BoardObject['lineStyle'])
      : undefined,
    frameId: raw.frameId != null ? str(raw.frameId, '') : undefined,
    aspectRatio: raw.aspectRatio != null ? num(raw.aspectRatio, 1) : undefined,
    points: Array.isArray(raw.points) ? (raw.points as number[]).filter(v => typeof v === 'number' && Number.isFinite(v)) : undefined,
    zIndex: num(raw.zIndex, 0),
  };
}

export function useBoardObjects(boardId: string) {
  const [objects, setObjects] = useState<BoardObject[]>([]);
  /** IDs of objects currently being dragged — Firestore snapshots must not override their local positions. */
  const draggingIdsRef = useRef<Set<string>>(new Set());
  /** Safety timeouts — auto-clear dragging IDs after 10s to prevent permanent Firestore blocking from leaked IDs. */
  const draggingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const colRef = collection(db, 'boards', boardId, 'objects');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const docs = snapshot.docs.map((doc) =>
        normalizeBoardObject({ ...doc.data(), id: doc.id }, doc.id)
      );
      setObjects(prev => {
        if (draggingIdsRef.current.size === 0) return docs;
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
    ids.forEach(id => {
      draggingIdsRef.current.add(id);
      // Clear any existing timeout for this id, then set a new safety timeout
      const existing = draggingTimeoutsRef.current.get(id);
      if (existing) clearTimeout(existing);
      const timeout = setTimeout(() => {
        draggingIdsRef.current.delete(id);
        draggingTimeoutsRef.current.delete(id);
      }, 10_000);
      draggingTimeoutsRef.current.set(id, timeout);
    });
  }, []);

  const unmarkDragging = useCallback((ids: string[]) => {
    ids.forEach(id => {
      draggingIdsRef.current.delete(id);
      const timeout = draggingTimeoutsRef.current.get(id);
      if (timeout) {
        clearTimeout(timeout);
        draggingTimeoutsRef.current.delete(id);
      }
    });
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
    (objectId: string, updates: Partial<BoardObject>) => {
      const existing = objects.find((o) => o.id === objectId);
      const safe = sanitizeUpdates(updates, existing);
      setObjects((prev) =>
        prev.map((o) => (o.id === objectId ? { ...o, ...safe } : o))
      );
      return fbUpdateObject(boardId, objectId, safe);
    },
    [boardId, objects]
  );

  const batchUpdateObjects = useCallback(
    (updates: Array<{ objectId: string; updates: Partial<BoardObject> }>) => {
      if (updates.length === 0) return;
      const safeUpdates = updates.map(({ objectId, updates: ups }) => {
        const existing = objects.find((o) => o.id === objectId);
        return { objectId, updates: sanitizeUpdates(ups, existing) };
      });
      setObjects((prev) => {
        const byId = new Map(prev.map((o) => [o.id, o]));
        for (const { objectId, updates: ups } of safeUpdates) {
          const current = byId.get(objectId);
          if (current) byId.set(objectId, { ...current, ...ups });
        }
        return prev.map((o) => byId.get(o.id) ?? o);
      });
      void fbUpdateObjectsBatch(boardId, safeUpdates);
    },
    [boardId, objects]
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

  return { objects, addObject, updateObject, batchUpdateObjects, deleteObject, clearObjects, markDragging, unmarkDragging };
}
