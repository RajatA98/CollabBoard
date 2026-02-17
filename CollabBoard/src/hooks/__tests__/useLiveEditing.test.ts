import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock firebase RTDB functions
const mockSetEditing = vi.fn().mockResolvedValue(undefined);
const mockRemoveEditing = vi.fn().mockResolvedValue(undefined);
const mockOnEditingsChange = vi.fn().mockReturnValue(vi.fn());
const mockSetupEditingDisconnect = vi.fn();

vi.mock('../../firebase/rtdb', () => ({
  setEditing: (...args: unknown[]) => mockSetEditing(...args),
  removeEditing: (...args: unknown[]) => mockRemoveEditing(...args),
  onEditingsChange: (...args: unknown[]) => mockOnEditingsChange(...args),
  setupEditingDisconnect: (...args: unknown[]) => mockSetupEditingDisconnect(...args),
}));

vi.mock('../../utils/cursor', () => ({
  hashColor: (uid: string) => `#color-${uid}`,
  filterRemoteData: (all: Record<string, unknown>, localUid: string) => {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(all)) {
      if (k !== localUid) result[k] = v;
    }
    return result;
  },
  shouldThrottleCursorUpdate: (lastUpdate: number, throttleMs: number) => {
    return Date.now() - lastUpdate < throttleMs;
  },
}));

import { useLiveEditing } from '../useLiveEditing';
import type { AppUser } from '../../types';

const mockUser: AppUser = {
  uid: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
};

describe('useLiveEditing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return empty remoteEditings initially', () => {
    const { result } = renderHook(() => useLiveEditing('board-1', mockUser));
    expect(result.current.remoteEditings).toEqual({});
  });

  it('should set up disconnect cleanup and listener when user is present', () => {
    renderHook(() => useLiveEditing('board-1', mockUser));

    expect(mockSetupEditingDisconnect).toHaveBeenCalledWith('board-1', 'user-1');
    expect(mockOnEditingsChange).toHaveBeenCalledWith('board-1', expect.any(Function));
  });

  it('should not set up listener when user is null', () => {
    renderHook(() => useLiveEditing('board-1', null));

    expect(mockSetupEditingDisconnect).not.toHaveBeenCalled();
    expect(mockOnEditingsChange).not.toHaveBeenCalled();
  });

  it('should update remoteEditings when listener fires', () => {
    let listenerCallback: (data: Record<string, unknown>) => void = () => {};
    mockOnEditingsChange.mockImplementation((_boardId: string, cb: (data: Record<string, unknown>) => void) => {
      listenerCallback = cb;
      return vi.fn();
    });

    const { result } = renderHook(() => useLiveEditing('board-1', mockUser));

    act(() => {
      listenerCallback({
        'user-2': {
          objectId: 'obj-1', text: 'typing...',
          userName: 'Alice', userColor: '#FF6B6B', lastActive: 123,
        },
      });
    });

    expect(result.current.remoteEditings['user-2']).toBeDefined();
    expect(result.current.remoteEditings['user-2'].text).toBe('typing...');
    expect(result.current.remoteEditings['user-1']).toBeUndefined();
  });

  it('broadcastEditing should call setEditing with correct data', () => {
    const { result } = renderHook(() => useLiveEditing('board-1', mockUser));

    vi.advanceTimersByTime(200);

    act(() => {
      result.current.broadcastEditing('obj-1', 'Hello world');
    });

    expect(mockSetEditing).toHaveBeenCalledWith('board-1', 'user-1', expect.objectContaining({
      objectId: 'obj-1',
      text: 'Hello world',
      userName: 'Test User',
      userColor: '#color-user-1',
    }));
  });

  it('broadcastEditing should throttle rapid calls', () => {
    const { result } = renderHook(() => useLiveEditing('board-1', mockUser));

    // First call goes through
    act(() => {
      result.current.broadcastEditing('obj-1', 'H');
    });
    expect(mockSetEditing).toHaveBeenCalledTimes(1);

    // Immediate second call throttled
    act(() => {
      result.current.broadcastEditing('obj-1', 'He');
    });
    expect(mockSetEditing).toHaveBeenCalledTimes(1);

    // After throttle period
    vi.advanceTimersByTime(200);
    act(() => {
      result.current.broadcastEditing('obj-1', 'Hel');
    });
    expect(mockSetEditing).toHaveBeenCalledTimes(2);
  });

  it('broadcastEditing should not call setEditing when user is null', () => {
    const { result } = renderHook(() => useLiveEditing('board-1', null));

    act(() => {
      result.current.broadcastEditing('obj-1', 'test');
    });

    expect(mockSetEditing).not.toHaveBeenCalled();
  });

  it('clearEditing should call removeEditing', () => {
    const { result } = renderHook(() => useLiveEditing('board-1', mockUser));

    act(() => {
      result.current.clearEditing();
    });

    expect(mockRemoveEditing).toHaveBeenCalledWith('board-1', 'user-1');
  });

  it('cleanupEditing should remove editing and reset state', async () => {
    const { result } = renderHook(() => useLiveEditing('board-1', mockUser));

    await act(async () => {
      await result.current.cleanupEditing();
    });

    expect(mockRemoveEditing).toHaveBeenCalledWith('board-1', 'user-1');
  });

  it('should unsubscribe listener on unmount', () => {
    const mockUnsubscribe = vi.fn();
    mockOnEditingsChange.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useLiveEditing('board-1', mockUser));
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
