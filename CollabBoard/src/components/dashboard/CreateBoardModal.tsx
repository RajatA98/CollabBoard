import { useState, type FormEvent } from 'react';
import { CollaboratorInvite, type InvitedUser } from '../shared/CollaboratorInvite';
import type { AppUser, FriendData } from '../../types';
import type { FriendWithUid } from '../../hooks/useFriends';

interface CreateBoardModalProps {
  user: AppUser;
  friends: FriendWithUid[];
  allFriends: Record<string, FriendData>;
  onSubmit: (name: string, visibility: 'open' | 'private', invited: InvitedUser[]) => Promise<void>;
  onCancel: () => void;
}

export function CreateBoardModal({ user, friends, allFriends, onSubmit, onCancel }: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'open' | 'private'>('private');
  const [invited, setInvited] = useState<InvitedUser[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), visibility, invited);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content create-board-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Board</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="board-name">Board Name</label>
            <input
              id="board-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
              autoFocus
              placeholder="Enter board name..."
            />
          </div>

          <div className="form-field">
            <label>Visibility</label>
            <div className="settings-visibility-toggle">
              <button
                type="button"
                className={`visibility-btn ${visibility === 'private' ? 'active' : ''}`}
                onClick={() => setVisibility('private')}
                disabled={submitting}
              >
                Private
              </button>
              <button
                type="button"
                className={`visibility-btn ${visibility === 'open' ? 'active' : ''}`}
                onClick={() => setVisibility('open')}
                disabled={submitting}
              >
                Public
              </button>
            </div>
            <span className="field-hint">
              {visibility === 'private'
                ? 'Only you and invited collaborators can access.'
                : 'Anyone can view and join this board.'}
            </span>
          </div>

          <div className="form-field">
            <label>Invite Collaborators</label>
            <CollaboratorInvite
              user={user}
              friends={friends}
              allFriends={allFriends}
              invited={invited}
              onInvitedChange={setInvited}
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
