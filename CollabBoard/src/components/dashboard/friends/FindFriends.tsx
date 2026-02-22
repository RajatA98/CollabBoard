import { useState, useEffect, useRef } from 'react';
import { searchUsers } from '../../../firebase/users';
import { FriendCard } from './FriendCard';
import type { UserProfile, FriendData, AppUser } from '../../../types';

interface FindFriendsProps {
  user: AppUser;
  allFriends: Record<string, FriendData>;
  onSendRequest: (uid: string) => void;
  onAccept: (uid: string) => void;
}

export function FindFriends({ user, allFriends, onSendRequest, onAccept }: FindFriendsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await searchUsers(q, user.uid);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, user.uid]);

  const getRelationship = (uid: string): FriendData | undefined => allFriends[uid];

  const renderActionButton = (targetUid: string) => {
    const rel = getRelationship(targetUid);
    if (!rel) {
      return (
        <button className="friend-action-btn friend-add-btn" onClick={() => onSendRequest(targetUid)}>
          Add Friend
        </button>
      );
    }
    switch (rel.status) {
      case 'accepted':
        return <span className="friend-status-label">Friends</span>;
      case 'pending_sent':
        return <span className="friend-status-label friend-status-pending">Pending</span>;
      case 'pending_received':
        return (
          <button className="friend-action-btn friend-accept-btn" onClick={() => onAccept(targetUid)}>
            Accept
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="find-friends">
      <div className="find-friends-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username or name..."
          className="find-friends-input"
          autoComplete="off"
        />
      </div>

      {searching && <div className="friends-loading">Searching...</div>}

      {!searching && searchQuery.trim().length >= 2 && results.length === 0 && (
        <div className="friends-empty">
          <p>No users found matching "{searchQuery.trim()}"</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="friends-list">
          {results.map((u) => (
            <FriendCard
              key={u.uid}
              displayName={u.displayName}
              username={u.username ?? ''}
              avatarColor={u.avatarColor}
            >
              {renderActionButton(u.uid)}
            </FriendCard>
          ))}
        </div>
      )}
    </div>
  );
}
