import { useState, useEffect } from 'react';
import {
  setPresence,
  onPresenceChange,
  setupPresenceDisconnect,
} from '../firebase/rtdb';
import { hashColor } from '../utils/cursor';
import { getOnlineUsers, createPresenceData } from '../utils/presence';
import type { AppUser, PresenceData } from '../types';

export function usePresence(boardId: string, user: AppUser | null) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceData[]>([]);

  useEffect(() => {
    if (!user) return;

    const color = hashColor(user.uid);
    const data = createPresenceData(
      user.displayName || user.email,
      user.email,
      color
    );

    setPresence(boardId, user.uid, data);
    setupPresenceDisconnect(boardId, user.uid);

    const unsubscribe = onPresenceChange(boardId, (allPresence) => {
      setOnlineUsers(getOnlineUsers(allPresence));
    });

    return () => {
      unsubscribe();
    };
  }, [boardId, user]);

  return { onlineUsers };
}
