import { FriendCard } from './FriendCard';
import type { FriendWithUid } from '../../../hooks/useFriends';

interface FriendsListProps {
  friends: FriendWithUid[];
  onRemove: (uid: string) => void;
}

export function FriendsList({ friends, onRemove }: FriendsListProps) {
  if (friends.length === 0) {
    return (
      <div className="friends-empty">
        <p>No friends yet.</p>
        <p>Use the "Find Friends" tab to search for people!</p>
      </div>
    );
  }

  return (
    <div className="friends-list">
      {friends.map((friend) => (
        <FriendCard
          key={friend.uid}
          displayName={friend.displayName}
          username={friend.username}
          avatarColor={friend.avatarColor}
        >
          <button
            className="friend-action-btn friend-remove-btn"
            onClick={() => onRemove(friend.uid)}
          >
            Remove
          </button>
        </FriendCard>
      ))}
    </div>
  );
}
