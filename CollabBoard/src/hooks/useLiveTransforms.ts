import { useState, useEffect, useCallback, useRef } from 'react';
import {
  setTransform,
  onTransformsChange,
  setupTransformDisconnect,
  removeTransform,
} from '../firebase/rtdb';
import { hashColor, filterRemoteData, shouldThrottleCursorUpdate } from '../utils/cursor';
import type { AppUser, LiveTransformData } from '../types';

const TRANSFORM_THROTTLE_MS = 50;

export function useLiveTransforms(boardId: string, user: AppUser | null) {
  const [remoteTransforms, setRemoteTransforms] = useState<Record<string, LiveTransformData>>({});
  const lastUpdateRef = useRef(0);
  const currentUserRef = useRef<{ boardId: string; userId: string } | null>(null);
  const isCleaningUpRef = useRef(false);

  const cleanupTransform = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    if (currentUserRef.current) {
      isCleaningUpRef.current = true;
      const { boardId: bid, userId: uid } = currentUserRef.current;
      try {
        await removeTransform(bid, uid);
      } catch (error) {
        console.error('Failed to remove transform:', error);
      }
      currentUserRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isCleaningUpRef.current) return;

    isCleaningUpRef.current = false;
    currentUserRef.current = { boardId, userId: user.uid };

    setupTransformDisconnect(boardId, user.uid);

    const unsubscribe = onTransformsChange(boardId, (allTransforms) => {
      const filtered = filterRemoteData(allTransforms, user.uid);
      setRemoteTransforms(filtered);
    });

    return () => {
      unsubscribe();
      if (!isCleaningUpRef.current && currentUserRef.current) {
        cleanupTransform();
      }
    };
  }, [boardId, user, cleanupTransform]);

  const broadcastTransform = useCallback(
    (objectId: string, x: number, y: number, width: number, height: number, rotation: number) => {
      if (!user) return;
      if (isCleaningUpRef.current) return;
      if (shouldThrottleCursorUpdate(lastUpdateRef.current, TRANSFORM_THROTTLE_MS)) return;
      lastUpdateRef.current = Date.now();

      const data: LiveTransformData = {
        objectId,
        x,
        y,
        width,
        height,
        rotation,
        userName: user.displayName || user.email,
        userColor: hashColor(user.uid),
        lastActive: Date.now(),
      };
      setTransform(boardId, user.uid, data);
    },
    [boardId, user]
  );

  const clearTransform = useCallback(() => {
    if (!user) return;
    removeTransform(boardId, user.uid);
    lastUpdateRef.current = 0;
  }, [boardId, user]);

  return { remoteTransforms, broadcastTransform, clearTransform, cleanupTransform };
}
