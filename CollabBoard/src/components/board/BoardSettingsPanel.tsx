import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CollaboratorInvite, type InvitedUser } from '../shared/CollaboratorInvite';
import { callInviteCollaborator, callRemoveCollaborator } from '../../firebase/invitations';
import { updateBoardName, updateBoardVisibility, deleteBoard } from '../../firebase/boardMeta';
import { useFriends } from '../../hooks/useFriends';
import type { AppUser, BoardMeta, CollaboratorEntry } from '../../types';

interface BoardSettingsPanelProps {
  user: AppUser;
  board: BoardMeta;
  onClose: () => void;
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

export function BoardSettingsPanel({ user, board, onClose }: BoardSettingsPanelProps) {
  const navigate = useNavigate();
  const isOwner = board.creatorId === user.uid;
  const { friends, allFriends } = useFriends(user);

  const [boardName, setBoardName] = useState(board.name);
  const [visibility, setVisibility] = useState<'open' | 'private'>(board.visibility);
  const [invited, setInvited] = useState<InvitedUser[]>([]);
  const [savingName, setSavingName] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setBoardName(board.name);
    setVisibility(board.visibility);
  }, [board.name, board.visibility]);

  const collaborators: { uid: string; entry: CollaboratorEntry }[] = board.collaborators
    ? Object.entries(board.collaborators).map(([uid, entry]) => ({ uid, entry }))
    : [];

  const existingCollaboratorUids = [
    board.creatorId,
    ...collaborators.map((c) => c.uid),
  ];

  const handleSaveName = useCallback(async () => {
    if (!isOwner) return;
    const trimmed = boardName.trim();
    if (trimmed === board.name) return;
    setSavingName(true);
    try {
      await updateBoardName(board.id, trimmed);
    } finally {
      setSavingName(false);
    }
  }, [isOwner, boardName, board.name, board.id]);

  const handleVisibilityChange = useCallback(async (v: 'open' | 'private') => {
    if (!isOwner) return;
    setVisibility(v);
    await updateBoardVisibility(board.id, v);
  }, [isOwner, board.id]);

  const handleInvite = useCallback(async () => {
    if (invited.length === 0) return;
    setInviting(true);
    try {
      for (const u of invited) {
        await callInviteCollaborator(board.id, u.uid, u.role);
      }
      setInvited([]);
    } catch (err) {
      console.error('Failed to invite:', err);
    } finally {
      setInviting(false);
    }
  }, [invited, board.id]);

  const handleRemoveCollaborator = useCallback(async (uid: string) => {
    if (!isOwner) return;
    if (!window.confirm('Remove this collaborator?')) return;
    try {
      await callRemoveCollaborator(board.id, uid);
    } catch (err) {
      console.error('Failed to remove collaborator:', err);
    }
  }, [isOwner, board.id]);

  const handleDeleteBoard = useCallback(async () => {
    if (!isOwner) return;
    setDeleting(true);
    try {
      await deleteBoard(board.id);
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to delete board:', err);
      setDeleting(false);
    }
  }, [isOwner, board.id, navigate]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content board-settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Board Settings</h2>

        {/* General */}
        <div className="settings-section">
          <h3 className="settings-section-title">General</h3>
          <div className="form-field">
            <label htmlFor="settings-board-name">Board Name</label>
            <div className="settings-name-row">
              <input
                id="settings-board-name"
                type="text"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                disabled={!isOwner || savingName}
              />
              {isOwner && (
                <button
                  type="button"
                  className="settings-save-btn"
                  onClick={handleSaveName}
                  disabled={savingName || boardName.trim() === board.name}
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="settings-section">
          <h3 className="settings-section-title">Visibility</h3>
          <div className="settings-visibility-toggle">
            <button
              type="button"
              className={`visibility-btn ${visibility === 'private' ? 'active' : ''}`}
              onClick={() => handleVisibilityChange('private')}
              disabled={!isOwner}
            >
              Private
            </button>
            <button
              type="button"
              className={`visibility-btn ${visibility === 'open' ? 'active' : ''}`}
              onClick={() => handleVisibilityChange('open')}
              disabled={!isOwner}
            >
              Public
            </button>
          </div>
          <p className="settings-visibility-hint">
            {visibility === 'private'
              ? 'Only owner and collaborators can access this board.'
              : 'Anyone can view and join this board.'}
          </p>
        </div>

        {/* Collaborators */}
        <div className="settings-section">
          <h3 className="settings-section-title">Collaborators</h3>

          {/* Current collaborators */}
          <div className="settings-collab-list">
            {/* Owner */}
            <div className="settings-collab-item">
              <div className="collab-invite-pick-avatar" style={{ background: user.avatarColor ?? '#667eea' }}>
                {getInitials(board.creatorName)}
              </div>
              <span className="settings-collab-name">{board.creatorName}</span>
              <span className="settings-collab-role-label">Owner</span>
            </div>

            {/* Collaborators */}
            {collaborators.map(({ uid, entry }) => (
              <div key={uid} className="settings-collab-item">
                <div className="collab-invite-pick-avatar" style={{ background: '#999' }}>
                  {getInitials(board.memberNames?.[uid] ?? uid.slice(0, 2))}
                </div>
                <span className="settings-collab-name">
                  {board.memberNames?.[uid] ?? uid.slice(0, 6)}
                </span>
                <span className={`settings-collab-status ${entry.status}`}>
                  {entry.status}
                </span>
                <span className="settings-collab-role-label">{entry.role}</span>
                {isOwner && (
                  <button
                    className="collab-invite-remove-btn"
                    onClick={() => handleRemoveCollaborator(uid)}
                    type="button"
                  >
                    &#10007;
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Invite new */}
          {isOwner && (
            <div className="settings-invite-section">
              <h4 className="settings-subsection-title">Invite Collaborators</h4>
              <CollaboratorInvite
                user={user}
                friends={friends}
                allFriends={allFriends}
                invited={invited}
                onInvitedChange={setInvited}
                existingCollaboratorUids={existingCollaboratorUids}
              />
              {invited.length > 0 && (
                <button
                  type="button"
                  className="settings-invite-btn"
                  onClick={handleInvite}
                  disabled={inviting}
                >
                  {inviting ? 'Inviting...' : `Invite ${invited.length} user${invited.length > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        {isOwner && (
          <div className="settings-section settings-danger-zone">
            <h3 className="settings-section-title danger">Danger Zone</h3>
            {!confirmDelete ? (
              <button
                type="button"
                className="settings-delete-btn"
                onClick={() => setConfirmDelete(true)}
              >
                Delete Board
              </button>
            ) : (
              <div className="settings-delete-confirm">
                <p>Are you sure? This cannot be undone.</p>
                <button
                  type="button"
                  className="settings-delete-btn"
                  onClick={handleDeleteBoard}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete Board'}
                </button>
                <button
                  type="button"
                  className="settings-cancel-btn"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
