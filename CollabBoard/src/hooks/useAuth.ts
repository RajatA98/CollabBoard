import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { signIn, signUp, signInWithGoogle, signOut } from '../firebase/auth';
import { onUserProfileChange, callEnsureUserProfile } from '../firebase/users';
import type { AppUser } from '../types';

function getAuthErrorMessage(err: unknown, fallback: string) {
  const anyErr = err as { code?: string; message?: string };
  switch (anyErr?.code) {
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a bit and try again.';
    case 'auth/email-already-in-use':
      return 'That email is already in use. Try logging in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use a stronger password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by the browser. Please allow popups and try again.';
    default:
      return anyErr?.message ?? fallback;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileUnsubRef = useRef<(() => void) | null>(null);
  const ensuredRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      if (firebaseUser) {
        const baseUser: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? '',
        };
        setUser(baseUser);
        setLoading(false);

        if (!ensuredRef.current) {
          ensuredRef.current = true;
          callEnsureUserProfile().catch((err) => {
            console.error('Failed to ensure user profile:', err);
          });
        }

        profileUnsubRef.current = onUserProfileChange(firebaseUser.uid, (profile) => {
          if (profile) {
            setUser((prev) => prev ? {
              ...prev,
              username: profile.username,
              avatarColor: profile.avatarColor,
              displayName: profile.displayName || prev.displayName,
            } : prev);
          }
        });
      } else {
        setUser(null);
        ensuredRef.current = false;
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signIn(email, password);
      return true;
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Login failed');
      setError(message);
      return false;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    try {
      await signUp(email, password, displayName);
      return true;
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Signup failed');
      setError(message);
      return false;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await signInWithGoogle();
      return true;
    } catch (err) {
      const anyErr = err as { code?: string };
      if (anyErr?.code === 'auth/popup-closed-by-user') {
        return false;
      }
      const message = getAuthErrorMessage(err, 'Google sign-in failed');
      setError(message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOut();
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Logout failed');
      setError(message);
    }
  }, []);

  return { user, loading, error, clearError, login, signup, loginWithGoogle, logout };
}
