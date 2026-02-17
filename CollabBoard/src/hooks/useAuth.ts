import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { signIn, signUp, signOut } from '../firebase/auth';
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
    default:
      return anyErr?.message ?? fallback;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? '',
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
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

  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOut();
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Logout failed');
      setError(message);
    }
  }, []);

  return { user, loading, error, clearError, login, signup, logout };
}
