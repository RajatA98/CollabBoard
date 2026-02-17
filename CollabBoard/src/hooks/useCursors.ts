import { useState, useEffect, useCallback, useRef } from 'react';
import { setCursor, onCursorsChange, setupCursorDisconnect, removeCursor } from '../firebase/rtdb';
import { hashColor, filterRemoteCursors, shouldThrottleCursorUpdate } from '../utils/cursor';
import type { AppUser, CursorData } from '../types';

const THROTTLE_MS = 30;

export function useCursors(boardId: string, user: AppUser | null) {
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const lastUpdateRef = useRef(0);
  const currentUserRef = useRef<{ boardId: string; userId: string } | null>(null);
  const isCleaningUpRef = useRef(false);

  // Exposed cleanup function that can be called explicitly
  const cleanupCursor = useCallback(async () => {
    if (isCleaningUpRef.current) {
      console.log('👁️ useCursors: Already cleaning up');
      return;
    }
    
    if (currentUserRef.current) {
      isCleaningUpRef.current = true;
      const { boardId: cleanupBoardId, userId: cleanupUserId } = currentUserRef.current;
      console.log('👁️ useCursors: Explicitly removing cursor for user:', cleanupUserId);
      try {
        await removeCursor(cleanupBoardId, cleanupUserId);
        console.log('✅ useCursors: Cursor removed successfully');
      } catch (error) {
        console.error('❌ useCursors: Failed to remove cursor:', error);
      }
      currentUserRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      console.log('👁️ useCursors: No user, skipping cursor setup');
      return;
    }

    // Prevent setting up cursor if we're in the middle of cleanup
    if (isCleaningUpRef.current) {
      console.log('👁️ useCursors: Cleanup in progress, skipping cursor setup');
      return;
    }

    console.log('👁️ useCursors: Setting up cursor tracking for', user.displayName || user.email, 'on board', boardId);
    
    // Reset cleanup flag when setting up fresh
    isCleaningUpRef.current = false;
    
    // Store current user info for cleanup
    currentUserRef.current = { boardId, userId: user.uid };

    setupCursorDisconnect(boardId, user.uid);

    const unsubscribe = onCursorsChange(boardId, (allCursors) => {
      console.log('👁️ useCursors: Received cursor update from Firebase RTDB:', allCursors);
      const filteredCursors = filterRemoteCursors(allCursors, user.uid);
      console.log('👁️ useCursors: Filtered remote cursors (excluding self):', filteredCursors);
      setCursors(filteredCursors);
    });

    return () => {
      console.log('👁️ useCursors: Cleaning up cursor listener and removing cursor data');
      unsubscribe();
      
      // Only cleanup if not already done
      if (!isCleaningUpRef.current && currentUserRef.current) {
        cleanupCursor();
      }
    };
  }, [boardId, user, cleanupCursor]);

  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!user) return;
      if (isCleaningUpRef.current) {
        console.log('👁️ useCursors: Cleanup in progress, ignoring cursor update');
        return;
      }
      if (shouldThrottleCursorUpdate(lastUpdateRef.current, THROTTLE_MS)) return;
      lastUpdateRef.current = Date.now();

      const cursorData: CursorData = {
        x,
        y,
        name: user.displayName || user.email,
        color: hashColor(user.uid),
        lastActive: Date.now(),
      };
      console.log('👁️ useCursors: Sending cursor update to Firebase RTDB:', cursorData);
      setCursor(boardId, user.uid, cursorData);
    },
    [boardId, user]
  );

  return { cursors, updateCursor, cleanupCursor };
}
