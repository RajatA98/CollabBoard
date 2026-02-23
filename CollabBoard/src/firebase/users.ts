import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { UserDoc } from '../types';

export async function ensureUserDoc(
  uid: string,
  email: string,
  displayName: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const newDoc: UserDoc = {
      email,
      displayName: displayName || '',
      subscriptionTier: 'free',
      aiCommandCount: 0,
      lastResetAt: Date.now(),
      createdAt: Date.now(),
    };
    await setDoc(userRef, newDoc);
  } else if (!snap.data().displayName && displayName) {
    // Backfill displayName that was saved as empty due to the onAuthStateChanged race condition
    await updateDoc(userRef, { displayName });
  }
}

export function onUserDocChange(
  uid: string,
  callback: (data: UserDoc | null) => void
): () => void {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as UserDoc);
    } else {
      callback(null);
    }
  });
}

export async function updateDisplayNameInFirestore(
  uid: string,
  displayName: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { displayName });
}
