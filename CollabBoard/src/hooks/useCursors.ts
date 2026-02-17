import { useState, useEffect, useCallback, useRef } from 'react';
import { setCursor, onCursorsChange, setupCursorDisconnect } from '../firebase/rtdb';
import { hashColor, filterRemoteCursors, shouldThrottleCursorUpdate } from '../utils/cursor';
import type { AppUser, CursorData } from '../types';

const THROTTLE_MS = 30;

export function useCursors(boardId: string, user: AppUser | null) {
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!user) return;

    setupCursorDisconnect(boardId, user.uid);

    const unsubscribe = onCursorsChange(boardId, (allCursors) => {
      setCursors(filterRemoteCursors(allCursors, user.uid));
    });

    return () => {
      unsubscribe();
    };
  }, [boardId, user]);

  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!user) return;
      if (shouldThrottleCursorUpdate(lastUpdateRef.current, THROTTLE_MS)) return;
      lastUpdateRef.current = Date.now();

      const cursorData: CursorData = {
        x,
        y,
        name: user.displayName || user.email,
        color: hashColor(user.uid),
        lastActive: Date.now(),
      };
      setCursor(boardId, user.uid, cursorData);
    },
    [boardId, user]
  );

  return { cursors, updateCursor };
}
