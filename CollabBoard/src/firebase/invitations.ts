import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './config';
import type { BoardInvitation } from '../types';

export function onPendingInvitationsChange(
  uid: string,
  callback: (invitations: BoardInvitation[]) => void
): () => void {
  const ref = collection(db, 'users', uid, 'invitations');
  const q = query(ref, where('status', '==', 'pending'));
  return onSnapshot(q, (snapshot) => {
    const invitations = snapshot.docs.map((d) => d.data() as BoardInvitation);
    invitations.sort((a, b) => b.createdAt - a.createdAt);
    callback(invitations);
  });
}

export function onAllInvitationsChange(
  uid: string,
  callback: (invitations: BoardInvitation[]) => void
): () => void {
  const ref = collection(db, 'users', uid, 'invitations');
  return onSnapshot(ref, (snapshot) => {
    const invitations = snapshot.docs.map((d) => d.data() as BoardInvitation);
    invitations.sort((a, b) => b.createdAt - a.createdAt);
    callback(invitations);
  });
}

export async function callRespondBoardInvitation(
  boardId: string,
  action: 'accept' | 'decline'
): Promise<{ success: boolean }> {
  const fn = httpsCallable<
    { boardId: string; action: 'accept' | 'decline' },
    { success: boolean }
  >(functions, 'respondBoardInvitation');
  const result = await fn({ boardId, action });
  return result.data;
}

export async function callInviteCollaborator(
  boardId: string,
  targetUid: string,
  role: 'editor' | 'viewer'
): Promise<{ success: boolean }> {
  const fn = httpsCallable<
    { boardId: string; targetUid: string; role: 'editor' | 'viewer' },
    { success: boolean }
  >(functions, 'inviteCollaborator');
  const result = await fn({ boardId, targetUid, role });
  return result.data;
}

export async function callRemoveCollaborator(
  boardId: string,
  targetUid: string
): Promise<{ success: boolean }> {
  const fn = httpsCallable<
    { boardId: string; targetUid: string },
    { success: boolean }
  >(functions, 'removeCollaborator');
  const result = await fn({ boardId, targetUid });
  return result.data;
}
