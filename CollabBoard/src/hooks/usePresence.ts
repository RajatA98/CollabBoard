import { useState, useEffect, useRef, useCallback } from 'react';
import {
  setPresence,
  onPresenceChange,
  setupPresenceDisconnect,
  removePresence,
} from '../firebase/rtdb';
import { hashColor } from '../utils/cursor';
import { getOnlineUsers, createPresenceData } from '../utils/presence';
import type { AppUser, PresenceData } from '../types';

export function usePresence(boardId: string, user: AppUser | null) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceData[]>([]);
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
    }
  }, []);

  useEffect(() => {
    if (!user) {
      console.log('👥 usePresence: No user, skipping presence setup');
      return;
    }

    // Prevent setting presence if we're in the middle of cleanup
    if (isCleaningUpRef.current) {
      console.log('👥 usePresence: Cleanup in progress, skipping presence setup');
      return;
    }

    console.log('👥 usePresence: Setting up presence for', user.displayName || user.email, 'on board', boardId);
    
    // Reset cleanup flag when setting up fresh
    isCleaningUpRef.current = false;
    
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
      const users = getOnlineUsers(allPresence);
      console.log('👥 usePresence: Online users:', users);
      setOnlineUsers(users);
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

  return { onlineUsers, cleanupPresence };
}
