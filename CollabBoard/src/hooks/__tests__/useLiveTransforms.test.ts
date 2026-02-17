import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock firebase RTDB functions
const mockSetTransform = vi.fn().mockResolvedValue(undefined);
const mockRemoveTransform = vi.fn().mockResolvedValue(undefined);
const mockOnTransformsChange = vi.fn().mockReturnValue(vi.fn());
const mockSetupTransformDisconnect = vi.fn();

vi.mock('../../firebase/rtdb', () => ({
  setTransform: (...args: unknown[]) => mockSetTransform(...args),
  removeTransform: (...args: unknown[]) => mockRemoveTransform(...args),
  onTransformsChange: (...args: unknown[]) => mockOnTransformsChange(...args),
  setupTransformDisconnect: (...args: unknown[]) => mockSetupTransformDisconnect(...args),
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

import { useLiveTransforms } from '../useLiveTransforms';
import type { AppUser } from '../../types';

const mockUser: AppUser = {
  uid: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
};

describe('useLiveTransforms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return empty remoteTransforms initially', () => {
    const { result } = renderHook(() => useLiveTransforms('board-1', mockUser));
    expect(result.current.remoteTransforms).toEqual({});
  });

  it('should set up disconnect cleanup and listener when user is present', () => {
    renderHook(() => useLiveTransforms('board-1', mockUser));

    expect(mockSetupTransformDisconnect).toHaveBeenCalledWith('board-1', 'user-1');
    expect(mockOnTransformsChange).toHaveBeenCalledWith('board-1', expect.any(Function));
  });

  it('should not set up listener when user is null', () => {
    renderHook(() => useLiveTransforms('board-1', null));

    expect(mockSetupTransformDisconnect).not.toHaveBeenCalled();
    expect(mockOnTransformsChange).not.toHaveBeenCalled();
  });

  it('should update remoteTransforms when listener fires', () => {
    let listenerCallback: (data: Record<string, unknown>) => void = () => {};
    mockOnTransformsChange.mockImplementation((_boardId: string, cb: (data: Record<string, unknown>) => void) => {
      listenerCallback = cb;
      return vi.fn();
    });

    const { result } = renderHook(() => useLiveTransforms('board-1', mockUser));

    act(() => {
      listenerCallback({
        'user-2': {
          objectId: 'obj-1', x: 50, y: 60, width: 200, height: 150,
          rotation: 10, userName: 'Alice', userColor: '#FF6B6B', lastActive: 123,
        },
      });
    });

    expect(result.current.remoteTransforms['user-2']).toBeDefined();
    expect(result.current.remoteTransforms['user-2'].objectId).toBe('obj-1');
    // Local user filtered out
    expect(result.current.remoteTransforms['user-1']).toBeUndefined();
  });

  it('broadcastTransform should call setTransform with correct data', () => {
    const { result } = renderHook(() => useLiveTransforms('board-1', mockUser));

    // Advance time enough to bypass throttle
    vi.advanceTimersByTime(100);

    act(() => {
      result.current.broadcastTransform('obj-1', 100, 200, 300, 150, 45);
    });

    expect(mockSetTransform).toHaveBeenCalledWith('board-1', 'user-1', expect.objectContaining({
      objectId: 'obj-1',
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      rotation: 45,
      userName: 'Test User',
      userColor: '#color-user-1',
    }));
  });

  it('broadcastTransform should throttle rapid calls', () => {
    const { result } = renderHook(() => useLiveTransforms('board-1', mockUser));

    // First call should go through (lastUpdate starts at 0)
    act(() => {
      result.current.broadcastTransform('obj-1', 10, 20, 100, 100, 0);
    });
    expect(mockSetTransform).toHaveBeenCalledTimes(1);

    // Second call immediately should be throttled
    act(() => {
      result.current.broadcastTransform('obj-1', 15, 25, 100, 100, 0);
    });
    expect(mockSetTransform).toHaveBeenCalledTimes(1); // still 1

    // After throttle period, next call goes through
    vi.advanceTimersByTime(60);
    act(() => {
      result.current.broadcastTransform('obj-1', 20, 30, 100, 100, 0);
    });
    expect(mockSetTransform).toHaveBeenCalledTimes(2);
  });

  it('broadcastTransform should not call setTransform when user is null', () => {
    const { result } = renderHook(() => useLiveTransforms('board-1', null));

    act(() => {
      result.current.broadcastTransform('obj-1', 100, 200, 300, 150, 45);
    });

    expect(mockSetTransform).not.toHaveBeenCalled();
  });

  it('clearTransform should call removeTransform', () => {
    const { result } = renderHook(() => useLiveTransforms('board-1', mockUser));

    act(() => {
      result.current.clearTransform();
    });

    expect(mockRemoveTransform).toHaveBeenCalledWith('board-1', 'user-1');
  });

  it('cleanupTransform should remove transform and reset state', async () => {
    const { result } = renderHook(() => useLiveTransforms('board-1', mockUser));

    await act(async () => {
      await result.current.cleanupTransform();
    });

    expect(mockRemoveTransform).toHaveBeenCalledWith('board-1', 'user-1');
  });

  it('should unsubscribe listener on unmount', () => {
    const mockUnsubscribe = vi.fn();
    mockOnTransformsChange.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useLiveTransforms('board-1', mockUser));
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
