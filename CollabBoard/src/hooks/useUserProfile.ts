import { useState, useEffect, useCallback, useRef } from 'react';
import {
  onUserProfileChange,
  callEnsureUserProfile,
  callClaimUsername,
  callCheckUsernameAvailable,
} from '../firebase/users';
import type { UserProfile, AppUser } from '../types';

export function useUserProfile(user: AppUser | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const ensuredRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      ensuredRef.current = false;
      return;
    }

    setLoading(true);

    if (!ensuredRef.current) {
      ensuredRef.current = true;
      callEnsureUserProfile().catch((err) => {
        console.error('Failed to ensure user profile:', err);
      });
    }

    const unsub = onUserProfileChange(user.uid, (p) => {
      setProfile(p);
      setLoading(false);
    });

    return unsub;
  }, [user]);

  const claimUsername = useCallback(
    async (username: string) => {
      if (!user) throw new Error('Not authenticated');
      return callClaimUsername(username);
    },
    [user]
  );

  const checkAvailability = useCallback(async (username: string) => {
    return callCheckUsernameAvailable(username);
  }, []);

  return { profile, loading, claimUsername, checkAvailability };
}
