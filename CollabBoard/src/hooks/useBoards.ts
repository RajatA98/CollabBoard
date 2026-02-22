import { useState, useEffect, useCallback } from 'react';
import {
  createBoard as fbCreateBoard,
  joinBoard as fbJoinBoard,
  leaveBoard as fbLeaveBoard,
  deleteBoard as fbDeleteBoard,
  onMyBoardsChange,
  onOpenBoardsChange,
} from '../firebase/boardMeta';
import type { BoardMeta, AppUser } from '../types';

export type BoardFilter = 'all' | 'owned' | 'shared';

export function useBoards(user: AppUser | null) {
  const [myBoards, setMyBoards] = useState<BoardMeta[]>([]);
  const [openBoards, setOpenBoards] = useState<BoardMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BoardFilter>('all');

  useEffect(() => {
    if (!user) {
      setMyBoards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onMyBoardsChange(user.uid, (boards) => {
      setMyBoards(boards);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOpenBoards([]);
      return;
    }
    const unsub = onOpenBoardsChange((boards) => {
      setOpenBoards(boards);
    });
    return unsub;
  }, [user]);

  const createBoard = useCallback(
    async (name: string, visibility: 'open' | 'private' = 'private') => {
      if (!user) throw new Error('Not authenticated');
      return fbCreateBoard(name, user.uid, user.displayName || user.email, visibility);
    },
    [user]
  );

  const joinBoard = useCallback(
    async (boardId: string) => {
      if (!user) throw new Error('Not authenticated');
      await fbJoinBoard(boardId, user.uid, user.displayName || user.email);
    },
    [user]
  );

  const leaveBoard = useCallback(
    async (boardId: string) => {
      if (!user) throw new Error('Not authenticated');
      await fbLeaveBoard(boardId, user.uid);
    },
    [user]
  );

  const deleteBoard = useCallback(
    async (boardId: string) => {
      if (!user) throw new Error('Not authenticated');
      await fbDeleteBoard(boardId);
    },
    [user]
  );

  const joinableBoards = openBoards.filter(
    (b) => user && !b.members.includes(user.uid)
  );

  const filteredBoards = myBoards.filter((b) => {
    if (!user) return false;
    if (filter === 'owned') return b.creatorId === user.uid;
    if (filter === 'shared') return b.creatorId !== user.uid;
    return true;
  });

  return {
    myBoards: filteredBoards,
    allMyBoards: myBoards,
    joinableBoards,
    loading,
    filter,
    setFilter,
    createBoard,
    joinBoard,
    leaveBoard,
    deleteBoard,
  };
}
