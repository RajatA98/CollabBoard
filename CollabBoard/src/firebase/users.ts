import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './config';
import type { UserProfile } from '../types';

export function onUserProfileChange(
  uid: string,
  callback: (profile: UserProfile | null) => void
): () => void {
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ ...snapshot.data(), uid: snapshot.id } as UserProfile);
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...snap.data(), uid: snap.id } as UserProfile;
}

export async function searchUsers(
  queryStr: string,
  currentUid: string,
  maxResults = 20
): Promise<UserProfile[]> {
  const lower = queryStr.toLowerCase().trim();
  if (lower.length < 2) return [];

  const usersRef = collection(db, 'users');
  const end = lower + '\uf8ff';

  const usernameQuery = query(
    usersRef,
    where('username', '>=', lower),
    where('username', '<=', end),
    orderBy('username'),
    limit(maxResults)
  );

  const displayNameQuery = query(
    usersRef,
    where('displayNameLower', '>=', lower),
    where('displayNameLower', '<=', end),
    orderBy('displayNameLower'),
    limit(maxResults)
  );

  const [usernameSnap, displayNameSnap] = await Promise.all([
    getDocs(usernameQuery),
    getDocs(displayNameQuery),
  ]);

  const seen = new Set<string>();
  const results: UserProfile[] = [];

  for (const snap of [usernameSnap, displayNameSnap]) {
    for (const d of snap.docs) {
      if (d.id === currentUid) continue;
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      results.push({ ...d.data(), uid: d.id } as UserProfile);
    }
  }

  return results.slice(0, maxResults);
}

export async function callEnsureUserProfile(): Promise<{ success: boolean; created: boolean }> {
  const fn = httpsCallable<Record<string, never>, { success: boolean; created: boolean }>(
    functions,
    'ensureUserProfile'
  );
  const result = await fn({});
  return result.data;
}

export async function callClaimUsername(
  username: string
): Promise<{ success: boolean; username: string }> {
  const fn = httpsCallable<{ username: string }, { success: boolean; username: string }>(
    functions,
    'claimUsername'
  );
  const result = await fn({ username });
  return result.data;
}

export async function callCheckUsernameAvailable(
  username: string
): Promise<{ available: boolean; reason?: string }> {
  const fn = httpsCallable<{ username: string }, { available: boolean; reason?: string }>(
    functions,
    'checkUsernameAvailable'
  );
  const result = await fn({ username });
  return result.data;
}
