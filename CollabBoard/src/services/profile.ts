import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';
import { updateDisplayNameInFirestore } from '../firebase/users';
import { setPresence } from '../firebase/rtdb';
import { hashColor } from '../utils/cursor';
import { createPresenceData } from '../utils/presence';

/**
 * Coordinated display name update across Firebase Auth, Firestore, and RTDB presence.
 * All three updates happen in parallel for speed, with Auth + Firestore being the critical ones.
 */
export async function updateUserDisplayName(
  uid: string,
  newName: string,
  boardId?: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const trimmed = newName.trim();
  if (trimmed.length < 2 || trimmed.length > 30) {
    throw new Error('Display name must be 2-30 characters');
  }

  // Update Auth and Firestore in parallel (critical)
  await Promise.all([
    updateProfile(currentUser, { displayName: trimmed }),
    updateDisplayNameInFirestore(uid, trimmed),
  ]);

  // Update RTDB presence for the current board (best-effort, non-blocking)
  if (boardId) {
    const color = hashColor(uid);
    const data = createPresenceData(trimmed, currentUser.email || '', color);
    setPresence(boardId, uid, data).catch((err) => {
      console.error('Failed to update RTDB presence:', err);
    });
  }
}
