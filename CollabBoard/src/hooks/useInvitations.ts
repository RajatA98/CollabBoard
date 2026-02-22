import { useState, useEffect, useCallback } from 'react';
import {
  onPendingInvitationsChange,
  onAllInvitationsChange,
  callRespondBoardInvitation,
} from '../firebase/invitations';
import type { BoardInvitation, AppUser } from '../types';

export function useInvitations(user: AppUser | null) {
  const [pendingInvitations, setPendingInvitations] = useState<BoardInvitation[]>([]);
  const [allInvitations, setAllInvitations] = useState<BoardInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPendingInvitations([]);
      setAllInvitations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub1 = onPendingInvitationsChange(user.uid, (inv) => {
      setPendingInvitations(inv);
      setLoading(false);
    });
    const unsub2 = onAllInvitationsChange(user.uid, (inv) => {
      setAllInvitations(inv);
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  const pendingCount = pendingInvitations.length;

  const pastInvitations = allInvitations.filter(
    (inv) => inv.status === 'accepted' || inv.status === 'declined'
  );

  const respond = useCallback(async (boardId: string, action: 'accept' | 'decline') => {
    return callRespondBoardInvitation(boardId, action);
  }, []);

  return {
    pendingInvitations,
    pastInvitations,
    pendingCount,
    loading,
    respond,
  };
}
