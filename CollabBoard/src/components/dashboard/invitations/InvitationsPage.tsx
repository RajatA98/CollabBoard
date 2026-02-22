import { useState } from 'react';
import type { BoardInvitation } from '../../../types';

interface InvitationsPageProps {
  pendingInvitations: BoardInvitation[];
  pastInvitations: BoardInvitation[];
  loading: boolean;
  onRespond: (boardId: string, action: 'accept' | 'decline') => Promise<unknown>;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

export function InvitationsPage({
  pendingInvitations,
  pastInvitations,
  loading,
  onRespond,
}: InvitationsPageProps) {
  const [showPast, setShowPast] = useState(false);

  if (loading) {
    return <div className="dashboard-loading">Loading invitations...</div>;
  }

  return (
    <div className="invitations-page">
      <h3 className="invitations-heading">Pending Invitations</h3>

      {pendingInvitations.length === 0 ? (
        <div className="friends-empty">
          <p>No pending invitations.</p>
        </div>
      ) : (
        <div className="invitations-list">
          {pendingInvitations.map((inv) => (
            <div key={inv.boardId} className="invitation-card">
              <div className="invitation-card-main">
                <div className="invitation-board-name">{inv.boardName}</div>
                <div className="invitation-meta">
                  <div className="invitation-invited-by">
                    <div
                      className="invitation-avatar"
                      style={{ background: inv.invitedByAvatarColor }}
                    >
                      {getInitials(inv.invitedByName)}
                    </div>
                    <span>
                      Invited by <strong>{inv.invitedByName}</strong>
                      {inv.invitedByUsername && (
                        <span className="invitation-username"> @{inv.invitedByUsername}</span>
                      )}
                    </span>
                  </div>
                  <div className="invitation-details">
                    <span className="invitation-role">Role: {inv.role}</span>
                    <span className="invitation-date">{formatDate(inv.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="invitation-actions">
                <button
                  className="friend-action-btn friend-accept-btn"
                  onClick={() => onRespond(inv.boardId, 'accept')}
                >
                  Accept
                </button>
                <button
                  className="friend-action-btn friend-decline-btn"
                  onClick={() => onRespond(inv.boardId, 'decline')}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pastInvitations.length > 0 && (
        <div className="past-invitations">
          <button
            className="past-invitations-toggle"
            onClick={() => setShowPast(!showPast)}
          >
            {showPast ? 'Hide' : 'Show'} Past Invitations ({pastInvitations.length})
          </button>

          {showPast && (
            <div className="invitations-list past">
              {pastInvitations.map((inv) => (
                <div key={inv.boardId} className="invitation-card invitation-card-past">
                  <div className="invitation-card-main">
                    <div className="invitation-board-name">{inv.boardName}</div>
                    <div className="invitation-meta">
                      <span className={`invitation-status-badge ${inv.status}`}>
                        {inv.status}
                      </span>
                      <span className="invitation-date">{formatDate(inv.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
