import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';

const mockOnAuthStateChanged = vi.fn();

vi.mock('../../firebase/config', () => ({
  auth: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock('../../firebase/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
  });

  it('should return null user initially when not authenticated', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
  });

  it('should return user when authenticated', async () => {
    const mockUser = { uid: '123', email: 'test@test.com', displayName: 'Test User' };
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: typeof mockUser) => void) => {
      callback(mockUser);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toEqual({
      uid: '123',
      email: 'test@test.com',
      displayName: 'Test User',
    });
  });

  it('should handle login', async () => {
    const mockUser = { uid: '123', email: 'test@test.com', displayName: 'Test' };
    const { signIn } = await import('../../firebase/auth');
    vi.mocked(signIn).mockResolvedValue(mockUser as ReturnType<typeof signIn> extends Promise<infer T> ? T : never);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('test@test.com', 'password123');
    });

    expect(signIn).toHaveBeenCalledWith('test@test.com', 'password123');
  });

  it('should handle signup', async () => {
    const mockUser = { uid: '123', email: 'test@test.com', displayName: 'Test' };
    const { signUp, signOut } = await import('../../firebase/auth');
    vi.mocked(signUp).mockResolvedValue(mockUser as ReturnType<typeof signUp> extends Promise<infer T> ? T : never);
    vi.mocked(signOut).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signup('test@test.com', 'password123', 'Test User');
    });

    expect(signUp).toHaveBeenCalledWith('test@test.com', 'password123', 'Test User');
    expect(signOut).toHaveBeenCalled();
  });

  it('should handle logout', async () => {
    const { signOut } = await import('../../firebase/auth');
    vi.mocked(signOut).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(signOut).toHaveBeenCalled();
  });

  it('should set error on login failure', async () => {
    const { signIn } = await import('../../firebase/auth');
    vi.mocked(signIn).mockRejectedValue(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('bad@test.com', 'wrong');
    });

    expect(result.current.error).toBe('Invalid credentials');
  });
});
