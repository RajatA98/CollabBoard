import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  setPresence,
  onPresenceChange,
  setupPresenceDisconnect,
  removePresence,
} from '../firebase/rtdb';
import { hashColor } from '../utils/cursor';
import { getMergedOnlineUsers, createPresenceData } from '../utils/presence';
import type { AppUser, PresenceData } from '../types';
import type { CursorData } from '../types';

export function usePresence(
  boardId: string,
  user: AppUser | null,
  cursors: Record<string, CursorData> = {}
) {
  const [rawPresence, setRawPresence] = useState<Record<string, PresenceData>>({});
  const currentUserRef = useRef<{ boardId: string; userId: string } | null>(null);
  const isCleaningUpRef = useRef(false);

  // Exposed cleanup function that can be called explicitly
  const cleanupPresence = useCallback(async () => {
    if (isCleaningUpRef.current) {
      console.log('👥 usePresence: Already cleaning up');
      return;
    }
    
    if (currentUserRef.current) {
      isCleaningUpRef.current = true;
      const { boardId: cleanupBoardId, userId: cleanupUserId } = currentUserRef.current;
      console.log('👥 usePresence: Explicitly removing presence for user:', cleanupUserId);
      try {
        await removePresence(cleanupBoardId, cleanupUserId);
        console.log('✅ usePresence: Presence removed successfully');
      } catch (error) {
        console.error('❌ usePresence: Failed to remove presence:', error);
      }
      currentUserRef.current = null;
      isCleaningUpRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      console.log('👥 usePresence: No user, skipping presence setup');
      return;
    }

    // Reset cleanup flag - we're setting up (fresh mount or after board/user change)
    isCleaningUpRef.current = false;

    console.log('👥 usePresence: Setting up presence for', user.displayName || user.email, 'on board', boardId);
    
    // Store current user info for cleanup
    currentUserRef.current = { boardId, userId: user.uid };

    const color = hashColor(user.uid);
    const data = createPresenceData(
      user.displayName || user.email,
      user.email,
      color
    );

    console.log('👥 usePresence: Sending presence data to Firebase RTDB:', data);
    setPresence(boardId, user.uid, data)
      .then(() => console.log('👥 usePresence: Presence data sent successfully'))
      .catch((error) => console.error('❌ usePresence: Failed to set presence:', error));
    
    setupPresenceDisconnect(boardId, user.uid);

    const unsubscribe = onPresenceChange(boardId, (allPresence) => {
      console.log('👥 usePresence: Received presence update from Firebase RTDB:', allPresence);
      setRawPresence(allPresence ?? {});
    });

    return () => {
      console.log('👥 usePresence: Cleaning up presence listener and removing presence data');
      unsubscribe();
      
      // Only cleanup if not already done
      if (!isCleaningUpRef.current && currentUserRef.current) {
        cleanupPresence();
      }
    };
  }, [boardId, user, cleanupPresence]);

  // Merge presence with cursors - if cursor is active, user is online
  const onlineUsers = useMemo(() => {
    const localPresence = user ? rawPresence[user.uid] ?? null : null;
    const localFallback = user
      ? { name: user.displayName || user.email || 'Anonymous', color: hashColor(user.uid) }
      : undefined;
    return getMergedOnlineUsers(
      rawPresence,
      cursors,
      user?.uid ?? '',
      localPresence,
      localFallback
    );
  }, [rawPresence, cursors, user]);

  return { onlineUsers, cleanupPresence };
}
