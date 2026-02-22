import { FriendCard } from './FriendCard';
import type { FriendWithUid } from '../../../hooks/useFriends';

interface FriendRequestsProps {
  received: FriendWithUid[];
  sent: FriendWithUid[];
  onAccept: (uid: string) => void;
  onDecline: (uid: string) => void;
  onCancel: (uid: string) => void;
}

export function FriendRequests({ received, sent, onAccept, onDecline, onCancel }: FriendRequestsProps) {
  const hasReceived = received.length > 0;
  const hasSent = sent.length > 0;

  if (!hasReceived && !hasSent) {
    return (
      <div className="friends-empty">
        <p>No pending friend requests.</p>
      </div>
    );
  }

  return (
    <div className="friend-requests">
      {hasReceived && (
        <div className="friend-requests-section">
          <h4 className="friend-requests-heading">Received</h4>
          {received.map((friend) => (
            <FriendCard
              key={friend.uid}
              displayName={friend.displayName}
              username={friend.username}
              avatarColor={friend.avatarColor}
            >
              <button
                className="friend-action-btn friend-accept-btn"
                onClick={() => onAccept(friend.uid)}
              >
                Accept
              </button>
              <button
                className="friend-action-btn friend-decline-btn"
                onClick={() => onDecline(friend.uid)}
              >
                Decline
              </button>
            </FriendCard>
          ))}
        </div>
      )}

      {hasSent && (
        <div className="friend-requests-section">
          <h4 className="friend-requests-heading">Sent</h4>
          {sent.map((friend) => (
            <FriendCard
              key={friend.uid}
              displayName={friend.displayName}
              username={friend.username}
              avatarColor={friend.avatarColor}
            >
              <button
                className="friend-action-btn friend-cancel-btn"
                onClick={() => onCancel(friend.uid)}
              >
                Cancel
              </button>
            </FriendCard>
          ))}
        </div>
      )}
    </div>
  );
}
