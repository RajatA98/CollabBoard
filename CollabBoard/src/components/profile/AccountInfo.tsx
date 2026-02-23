import { useState, useCallback } from 'react';
import { hashColor } from '../../utils/cursor';
import { updateUserDisplayName } from '../../services/profile';
import type { AppUser } from '../../types';

interface AccountInfoProps {
  user: AppUser;
  boardId?: string;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AccountInfo({ user, boardId }: AccountInfoProps) {
  const [editName, setEditName] = useState(user.displayName || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const color = hashColor(user.uid);
  const initials = getInitials(user.displayName || user.email);

  const handleSave = useCallback(async () => {
    const trimmed = editName.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      setFeedback({ type: 'error', message: 'Name must be 2-30 characters.' });
      return;
    }
    if (trimmed === user.displayName) {
      setFeedback(null);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await updateUserDisplayName(user.uid, trimmed, boardId);
      setFeedback({ type: 'success', message: 'Name updated!' });
    } catch {
      setEditName(user.displayName || '');
      setFeedback({ type: 'error', message: 'Failed to update name. Try again.' });
    } finally {
      setSaving(false);
    }
  }, [editName, user.uid, user.displayName, boardId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  return (
    <div className="profile-account-info">
      <div className="profile-avatar" style={{ background: color }}>
        {initials}
      </div>
      <div className="profile-field">
        <label className="profile-field-label">Email</label>
        <div className="profile-field-value">{user.email}</div>
      </div>
      <div className="profile-field">
        <label className="profile-field-label" htmlFor="profile-display-name">Display Name</label>
        <div className="profile-name-row">
          <input
            id="profile-display-name"
            type="text"
            className="profile-name-input"
            value={editName}
            onChange={(e) => {
              setEditName(e.target.value);
              setFeedback(null);
            }}
            onKeyDown={handleKeyDown}
            maxLength={30}
            disabled={saving}
          />
          <button
            className="profile-name-save"
            onClick={handleSave}
            disabled={saving || editName.trim() === user.displayName}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {feedback && (
          <div className={`profile-feedback profile-feedback-${feedback.type}`}>
            {feedback.message}
          </div>
        )}
        {!user.displayName && !feedback && (
          <div className="profile-feedback profile-feedback-info">
            Set a display name so other collaborators can see who you are.
          </div>
        )}
      </div>
    </div>
  );
}
