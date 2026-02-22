import { useState, useEffect, useCallback } from 'react';
import {
  onFriendsChange,
  callSendFriendRequest,
  callRespondFriendRequest,
  callRemoveFriend,
} from '../firebase/friends';
import type { FriendData, AppUser } from '../types';

export interface FriendWithUid extends FriendData {
  uid: string;
}

export function useFriends(user: AppUser | null) {
  const [allFriends, setAllFriends] = useState<Record<string, FriendData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAllFriends({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onFriendsChange(user.uid, (friends) => {
      setAllFriends(friends);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const friends: FriendWithUid[] = Object.entries(allFriends)
    .filter(([, f]) => f.status === 'accepted')
    .map(([uid, f]) => ({ ...f, uid }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const pendingReceived: FriendWithUid[] = Object.entries(allFriends)
    .filter(([, f]) => f.status === 'pending_received')
    .map(([uid, f]) => ({ ...f, uid }))
    .sort((a, b) => b.since - a.since);

  const pendingSent: FriendWithUid[] = Object.entries(allFriends)
    .filter(([, f]) => f.status === 'pending_sent')
    .map(([uid, f]) => ({ ...f, uid }))
    .sort((a, b) => b.since - a.since);

  const pendingReceivedCount = pendingReceived.length;

  const sendRequest = useCallback(async (targetUid: string) => {
    return callSendFriendRequest(targetUid);
  }, []);

  const respond = useCallback(async (friendUid: string, action: 'accept' | 'decline') => {
    return callRespondFriendRequest(friendUid, action);
  }, []);

  const remove = useCallback(async (friendUid: string) => {
    return callRemoveFriend(friendUid);
  }, []);

  return {
    friends,
    pendingReceived,
    pendingSent,
    pendingReceivedCount,
    allFriends,
    loading,
    sendRequest,
    respond,
    remove,
  };
}
