import { useState, useEffect, useCallback, useRef } from 'react';
import { setCursor, removeCursor, onCursorsChange, setupCursorDisconnect } from '../firebase/rtdb';
import { hashColor, filterRemoteCursors, shouldThrottleCursorUpdate } from '../utils/cursor';
import type { AppUser, CursorData } from '../types';

const THROTTLE_MS = 30;
// Hide cursors that haven't moved in this many milliseconds
const STALE_CURSOR_MS = 10_000;

export function useCursors(boardId: string, user: AppUser | null) {
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!user) return;

    setupCursorDisconnect(boardId, user.uid);

    const unsubscribe = onCursorsChange(boardId, (allCursors) => {
      const now = Date.now();
      const active: Record<string, CursorData> = {};
      for (const [uid, cursor] of Object.entries(allCursors)) {
        if (now - cursor.lastActive < STALE_CURSOR_MS) {
          active[uid] = cursor;
        }
      }
      setCursors(filterRemoteCursors(active, user.uid));
    });

    // Periodically prune stale cursors from local state
    const pruneInterval = setInterval(() => {
      setCursors((prev) => {
        const now = Date.now();
        const next: Record<string, CursorData> = {};
        for (const [uid, cursor] of Object.entries(prev)) {
          if (now - cursor.lastActive < STALE_CURSOR_MS) {
            next[uid] = cursor;
          }
        }
        return next;
      });
    }, 5_000);

    return () => {
      unsubscribe();
      clearInterval(pruneInterval);
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

  const hideCursor = useCallback(() => {
    if (!user) return;
    removeCursor(boardId, user.uid);
  }, [boardId, user]);

  return { cursors, updateCursor, hideCursor };
}
