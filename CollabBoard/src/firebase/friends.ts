import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './config';
import type { FriendData } from '../types';

export function onFriendsChange(
  uid: string,
  callback: (friends: Record<string, FriendData>) => void
): () => void {
  const ref = collection(db, 'users', uid, 'friends');
  return onSnapshot(ref, (snapshot) => {
    const friends: Record<string, FriendData> = {};
    snapshot.docs.forEach((d) => {
      friends[d.id] = d.data() as FriendData;
    });
    callback(friends);
  });
}

export async function callSendFriendRequest(targetUid: string): Promise<{ success: boolean }> {
  const fn = httpsCallable<{ targetUid: string }, { success: boolean }>(
    functions,
    'sendFriendRequest'
  );
  const result = await fn({ targetUid });
  return result.data;
}

export async function callRespondFriendRequest(
  friendUid: string,
  action: 'accept' | 'decline'
): Promise<{ success: boolean }> {
  const fn = httpsCallable<
    { friendUid: string; action: 'accept' | 'decline' },
    { success: boolean }
  >(functions, 'respondFriendRequest');
  const result = await fn({ friendUid, action });
  return result.data;
}

export async function callRemoveFriend(friendUid: string): Promise<{ success: boolean }> {
  const fn = httpsCallable<{ friendUid: string }, { success: boolean }>(
    functions,
    'removeFriend'
  );
  const result = await fn({ friendUid });
  return result.data;
}
