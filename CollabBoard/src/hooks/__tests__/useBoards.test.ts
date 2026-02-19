import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBoards } from '../useBoards';
import type { AppUser, BoardMeta } from '../../types';

const mockOnMyBoardsChange = vi.fn();
const mockOnOpenBoardsChange = vi.fn();
const mockCreateBoard = vi.fn();
const mockJoinBoard = vi.fn();
const mockLeaveBoard = vi.fn();
const mockDeleteBoard = vi.fn();

vi.mock('../../firebase/boardMeta', () => ({
  onMyBoardsChange: (...args: unknown[]) => mockOnMyBoardsChange(...args),
  onOpenBoardsChange: (...args: unknown[]) => mockOnOpenBoardsChange(...args),
  createBoard: (...args: unknown[]) => mockCreateBoard(...args),
  joinBoard: (...args: unknown[]) => mockJoinBoard(...args),
  leaveBoard: (...args: unknown[]) => mockLeaveBoard(...args),
  deleteBoard: (...args: unknown[]) => mockDeleteBoard(...args),
}));

const testUser: AppUser = {
  uid: 'user-1',
  email: 'test@test.com',
  displayName: 'Test User',
};

const sampleBoard: BoardMeta = {
  id: 'b1',
  name: 'Test Board',
  creatorId: 'user-1',
  creatorName: 'Test User',
  members: ['user-1'],
  memberNames: { 'user-1': 'Test User' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  visibility: 'open',
};

describe('useBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnMyBoardsChange.mockImplementation((_uid: string, cb: (boards: BoardMeta[]) => void) => {
      cb([]);
      return vi.fn();
    });
    mockOnOpenBoardsChange.mockImplementation((cb: (boards: BoardMeta[]) => void) => {
      cb([]);
      return vi.fn();
    });
  });

  it('should return empty boards when user is null', () => {
    const { result } = renderHook(() => useBoards(null));
    expect(result.current.myBoards).toEqual([]);
    expect(result.current.joinableBoards).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should set up subscriptions when user is provided', () => {
    renderHook(() => useBoards(testUser));
    expect(mockOnMyBoardsChange).toHaveBeenCalledWith('user-1', expect.any(Function));
    expect(mockOnOpenBoardsChange).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should populate myBoards from subscription', async () => {
    mockOnMyBoardsChange.mockImplementation((_uid: string, cb: (boards: BoardMeta[]) => void) => {
      cb([sampleBoard]);
      return vi.fn();
    });

    const { result } = renderHook(() => useBoards(testUser));
    await waitFor(() => {
      expect(result.current.myBoards).toHaveLength(1);
      expect(result.current.myBoards[0].name).toBe('Test Board');
    });
  });

  it('should filter joinable boards to exclude user member boards', async () => {
    const openBoard: BoardMeta = {
      ...sampleBoard,
      id: 'b2',
      name: 'Other Board',
      creatorId: 'user-2',
      members: ['user-2'],
    };

    mockOnOpenBoardsChange.mockImplementation((cb: (boards: BoardMeta[]) => void) => {
      cb([sampleBoard, openBoard]);
      return vi.fn();
    });

    const { result } = renderHook(() => useBoards(testUser));
    await waitFor(() => {
      expect(result.current.joinableBoards).toHaveLength(1);
      expect(result.current.joinableBoards[0].id).toBe('b2');
    });
  });

  it('should call createBoard with correct parameters', async () => {
    mockCreateBoard.mockResolvedValue(sampleBoard);

    const { result } = renderHook(() => useBoards(testUser));

    await act(async () => {
      const board = await result.current.createBoard('New Board');
      expect(board).toEqual(sampleBoard);
    });

    expect(mockCreateBoard).toHaveBeenCalledWith('New Board', 'user-1', 'Test User');
  });

  it('should call joinBoard with correct parameters', async () => {
    mockJoinBoard.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoards(testUser));

    await act(async () => {
      await result.current.joinBoard('board-1');
    });

    expect(mockJoinBoard).toHaveBeenCalledWith('board-1', 'user-1', 'Test User');
  });

  it('should call leaveBoard with correct parameters', async () => {
    mockLeaveBoard.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoards(testUser));

    await act(async () => {
      await result.current.leaveBoard('board-1');
    });

    expect(mockLeaveBoard).toHaveBeenCalledWith('board-1', 'user-1');
  });

  it('should throw when createBoard is called without user', async () => {
    const { result } = renderHook(() => useBoards(null));

    await expect(
      act(async () => {
        await result.current.createBoard('Test');
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('should call deleteBoard with boardId', async () => {
    mockDeleteBoard.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoards(testUser));

    await act(async () => {
      await result.current.deleteBoard('board-1');
    });

    expect(mockDeleteBoard).toHaveBeenCalledWith('board-1');
  });
});
