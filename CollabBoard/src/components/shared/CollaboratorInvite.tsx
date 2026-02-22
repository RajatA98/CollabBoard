import { useState, useEffect, useRef } from 'react';
import { searchUsers } from '../../firebase/users';
import type { UserProfile, AppUser, FriendData } from '../../types';
import type { FriendWithUid } from '../../hooks/useFriends';

export interface InvitedUser {
  uid: string;
  displayName: string;
  username: string;
  avatarColor: string;
  role: 'editor' | 'viewer';
}

interface CollaboratorInviteProps {
  user: AppUser;
  friends: FriendWithUid[];
  allFriends: Record<string, FriendData>;
  invited: InvitedUser[];
  onInvitedChange: (invited: InvitedUser[]) => void;
  existingCollaboratorUids?: string[];
}

type SearchMode = 'friends' | 'search';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

export function CollaboratorInvite({
  user,
  friends,
  invited,
  onInvitedChange,
  existingCollaboratorUids = [],
}: CollaboratorInviteProps) {
  const [mode, setMode] = useState<SearchMode>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invitedUids = new Set(invited.map((u) => u.uid));
  const existingUids = new Set(existingCollaboratorUids);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (mode !== 'search') return;

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(q, user.uid);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, mode, user.uid]);

  const addUser = (u: { uid: string; displayName: string; username?: string; avatarColor: string }) => {
    if (invitedUids.has(u.uid) || existingUids.has(u.uid)) return;
    onInvitedChange([
      ...invited,
      {
        uid: u.uid,
        displayName: u.displayName,
        username: u.username ?? '',
        avatarColor: u.avatarColor,
        role: 'editor',
      },
    ]);
  };

  const removeUser = (uid: string) => {
    onInvitedChange(invited.filter((u) => u.uid !== uid));
  };

  const updateRole = (uid: string, role: 'editor' | 'viewer') => {
    onInvitedChange(
      invited.map((u) => (u.uid === uid ? { ...u, role } : u))
    );
  };

  return (
    <div className="collab-invite">
      <div className="collab-invite-mode-toggle">
        <button
          className={`collab-mode-btn ${mode === 'friends' ? 'active' : ''}`}
          onClick={() => setMode('friends')}
          type="button"
        >
          Friends
        </button>
        <button
          className={`collab-mode-btn ${mode === 'search' ? 'active' : ''}`}
          onClick={() => setMode('search')}
          type="button"
        >
          Search All Users
        </button>
      </div>

      {mode === 'friends' && (
        <div className="collab-invite-friends-list">
          {friends.length === 0 ? (
            <div className="collab-invite-empty">No friends to invite. Try searching for users.</div>
          ) : (
            friends
              .filter((f) => !invitedUids.has(f.uid) && !existingUids.has(f.uid))
              .map((f) => (
                <div key={f.uid} className="collab-invite-pick" onClick={() => addUser(f)}>
                  <div className="collab-invite-pick-avatar" style={{ background: f.avatarColor }}>
                    {getInitials(f.displayName)}
                  </div>
                  <span className="collab-invite-pick-name">{f.displayName}</span>
                  {f.username && <span className="collab-invite-pick-username">@{f.username}</span>}
                </div>
              ))
          )}
        </div>
      )}

      {mode === 'search' && (
        <div className="collab-invite-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username or name..."
            className="collab-invite-search-input"
            autoComplete="off"
          />
          {searching && <div className="friends-loading">Searching...</div>}
          {searchResults.length > 0 && (
            <div className="collab-invite-results">
              {searchResults
                .filter((u) => !invitedUids.has(u.uid) && !existingUids.has(u.uid))
                .map((u) => (
                  <div key={u.uid} className="collab-invite-pick" onClick={() => addUser(u)}>
                    <div className="collab-invite-pick-avatar" style={{ background: u.avatarColor }}>
                      {getInitials(u.displayName)}
                    </div>
                    <span className="collab-invite-pick-name">{u.displayName}</span>
                    {u.username && <span className="collab-invite-pick-username">@{u.username}</span>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {invited.length > 0 && (
        <div className="collab-invite-selected">
          <label className="collab-invite-selected-label">Invited ({invited.length})</label>
          {invited.map((u) => (
            <div key={u.uid} className="collab-invite-selected-item">
              <div className="collab-invite-pick-avatar" style={{ background: u.avatarColor }}>
                {getInitials(u.displayName)}
              </div>
              <span className="collab-invite-pick-name">{u.displayName}</span>
              <select
                className="collab-role-select"
                value={u.role}
                onChange={(e) => updateRole(u.uid, e.target.value as 'editor' | 'viewer')}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                className="collab-invite-remove-btn"
                onClick={() => removeUser(u.uid)}
                type="button"
              >
                &#10007;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
