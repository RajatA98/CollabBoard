import { useState, useEffect, useRef, useCallback } from 'react';
import { ensureUserDoc, onUserDocChange } from '../firebase/users';
import type { AppUser, UserDoc } from '../types';

export function useSubscription(user: AppUser | null) {
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const userUid = user?.uid ?? null;
  const userEmail = user?.email ?? '';
  const userDisplayName = user?.displayName ?? '';

  const handleDocChange = useCallback((data: UserDoc | null) => {
    setUserDoc(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userUid) {
      initializedRef.current = false;
      // Use a microtask to avoid calling setState synchronously in effect body
      queueMicrotask(() => {
        setUserDoc(null);
        setLoading(false);
      });
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const setup = async () => {
      if (!initializedRef.current) {
        try {
          await ensureUserDoc(userUid, userEmail, userDisplayName);
        } catch (err) {
          console.error('Failed to ensure user doc:', err);
        }
        initializedRef.current = true;
      }

      if (cancelled) return;

      unsubscribe = onUserDocChange(userUid, handleDocChange);
    };

    setup();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [userUid, userEmail, userDisplayName, handleDocChange]);

  return {
    userDoc,
    loading,
    tier: (userDoc?.subscriptionTier ?? 'free') as 'free' | 'pro',
    aiCommandCount: userDoc?.aiCommandCount ?? 0,
    subscriptionStatus: userDoc?.subscriptionStatus,
    currentPeriodEnd: userDoc?.currentPeriodEnd,
  };
}
