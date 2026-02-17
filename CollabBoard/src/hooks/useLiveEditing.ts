import { useState, useEffect, useCallback, useRef } from 'react';
import {
  setEditing,
  onEditingsChange,
  setupEditingDisconnect,
  removeEditing,
} from '../firebase/rtdb';
import { hashColor, filterRemoteData, shouldThrottleCursorUpdate } from '../utils/cursor';
import type { AppUser, LiveEditingData } from '../types';

const EDITING_THROTTLE_MS = 150;

export function useLiveEditing(boardId: string, user: AppUser | null) {
  const [remoteEditings, setRemoteEditings] = useState<Record<string, LiveEditingData>>({});
  const lastUpdateRef = useRef(0);
  const currentUserRef = useRef<{ boardId: string; userId: string } | null>(null);
  const isCleaningUpRef = useRef(false);

  const cleanupEditing = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    if (currentUserRef.current) {
      isCleaningUpRef.current = true;
      const { boardId: bid, userId: uid } = currentUserRef.current;
      try {
        await removeEditing(bid, uid);
      } catch (error) {
        console.error('Failed to remove editing:', error);
      }
      currentUserRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isCleaningUpRef.current) return;

    isCleaningUpRef.current = false;
    currentUserRef.current = { boardId, userId: user.uid };

    setupEditingDisconnect(boardId, user.uid);

    const unsubscribe = onEditingsChange(boardId, (allEditings) => {
      const filtered = filterRemoteData(allEditings, user.uid);
      setRemoteEditings(filtered);
    });

    return () => {
      unsubscribe();
      if (!isCleaningUpRef.current && currentUserRef.current) {
        cleanupEditing();
      }
    };
  }, [boardId, user, cleanupEditing]);

  const broadcastEditing = useCallback(
    (objectId: string, text: string) => {
      if (!user) return;
      if (isCleaningUpRef.current) return;
      if (shouldThrottleCursorUpdate(lastUpdateRef.current, EDITING_THROTTLE_MS)) return;
      lastUpdateRef.current = Date.now();

      const data: LiveEditingData = {
        objectId,
        text,
        userName: user.displayName || user.email,
        userColor: hashColor(user.uid),
        lastActive: Date.now(),
      };
      setEditing(boardId, user.uid, data);
    },
    [boardId, user]
  );

  const clearEditing = useCallback(() => {
    if (!user) return;
    removeEditing(boardId, user.uid);
    lastUpdateRef.current = 0;
  }, [boardId, user]);

  return { remoteEditings, broadcastEditing, clearEditing, cleanupEditing };
}
