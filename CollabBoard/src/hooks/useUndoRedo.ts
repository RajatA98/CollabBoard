import { useState, useCallback, useRef } from 'react';
import type { BoardObject } from '../types';

export type UndoAction =
  | { type: 'add'; objects: BoardObject[] }
  | { type: 'delete'; objects: BoardObject[] }
  | { type: 'update'; changes: { id: string; before: Partial<BoardObject>; after: Partial<BoardObject> }[] };

interface UndoRedoCallbacks {
  addObject: (object: BoardObject) => Promise<void>;
  updateObject: (id: string, updates: Partial<BoardObject>) => Promise<void>;
  deleteObject: (id: string) => Promise<void>;
}

const MAX_STACK_SIZE = 50;

export function useUndoRedo(callbacks: UndoRedoCallbacks) {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const isApplyingRef = useRef(false);

  const pushAction = useCallback((action: UndoAction) => {
    if (isApplyingRef.current) return;
    setUndoStack(prev => [...prev.slice(-MAX_STACK_SIZE + 1), action]);
    setRedoStack([]);
  }, []);

  const applyAction = useCallback(async (action: UndoAction) => {
    isApplyingRef.current = true;
    try {
      switch (action.type) {
        case 'add':
          await Promise.all(action.objects.map(obj => callbacks.addObject(obj)));
          break;
        case 'delete':
          await Promise.all(action.objects.map(obj => callbacks.deleteObject(obj.id)));
          break;
        case 'update':
          await Promise.all(
            action.changes.map(change => callbacks.updateObject(change.id, change.after))
          );
          break;
      }
    } finally {
      isApplyingRef.current = false;
    }
  }, [callbacks]);

  const reverseAction = useCallback(async (action: UndoAction) => {
    isApplyingRef.current = true;
    try {
      switch (action.type) {
        case 'add':
          // Undo add = delete
          await Promise.all(action.objects.map(obj => callbacks.deleteObject(obj.id)));
          break;
        case 'delete':
          // Undo delete = re-add
          await Promise.all(action.objects.map(obj => callbacks.addObject(obj)));
          break;
        case 'update':
          // Undo update = apply 'before' values
          await Promise.all(
            action.changes.map(change => callbacks.updateObject(change.id, change.before))
          );
          break;
      }
    } finally {
      isApplyingRef.current = false;
    }
  }, [callbacks]);

  const undo = useCallback(async () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const action = prev[prev.length - 1];
      const newStack = prev.slice(0, -1);
      reverseAction(action).then(() => {
        setRedoStack(rPrev => [...rPrev, action]);
      });
      return newStack;
    });
  }, [reverseAction]);

  const redo = useCallback(async () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const action = prev[prev.length - 1];
      const newStack = prev.slice(0, -1);
      applyAction(action).then(() => {
        setUndoStack(uPrev => [...uPrev, action]);
      });
      return newStack;
    });
  }, [applyAction]);

  return {
    pushAction,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
