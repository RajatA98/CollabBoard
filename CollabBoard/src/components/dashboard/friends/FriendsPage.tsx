import { useState, useCallback } from 'react';
import { FriendsList } from './FriendsList';
import { FriendRequests } from './FriendRequests';
import { FindFriends } from './FindFriends';
import type { FriendWithUid } from '../../../hooks/useFriends';
import type { FriendData, AppUser } from '../../../types';

type FriendsTab = 'friends' | 'requests' | 'find';

interface FriendsPageProps {
  user: AppUser;
  friends: FriendWithUid[];
  pendingReceived: FriendWithUid[];
  pendingSent: FriendWithUid[];
  allFriends: Record<string, FriendData>;
  loading: boolean;
  onSendRequest: (uid: string) => Promise<unknown>;
  onRespond: (uid: string, action: 'accept' | 'decline') => Promise<unknown>;
  onRemove: (uid: string) => Promise<unknown>;
}

export function FriendsPage({
  user,
  friends,
  pendingReceived,
  pendingSent,
  allFriends,
  loading,
  onSendRequest,
  onRespond,
  onRemove,
}: FriendsPageProps) {
  const [activeTab, setActiveTab] = useState<FriendsTab>('friends');

  const handleRemove = useCallback(
    async (uid: string) => {
      if (!window.confirm('Remove this friend?')) return;
      await onRemove(uid);
    },
    [onRemove]
  );

  const handleAccept = useCallback(
    (uid: string) => onRespond(uid, 'accept'),
    [onRespond]
  );

  const handleDecline = useCallback(
    (uid: string) => onRespond(uid, 'decline'),
    [onRespond]
  );

  const handleCancel = useCallback(
    (uid: string) => onRemove(uid),
    [onRemove]
  );

  if (loading) {
    return <div className="dashboard-loading">Loading friends...</div>;
  }

  return (
    <div className="friends-page">
      <div className="friends-tabs">
        <button
          className={`friends-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends ({friends.length})
        </button>
        <button
          className={`friends-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests
          {pendingReceived.length > 0 && (
            <span className="badge">{pendingReceived.length}</span>
          )}
        </button>
        <button
          className={`friends-tab ${activeTab === 'find' ? 'active' : ''}`}
          onClick={() => setActiveTab('find')}
        >
          Find Friends
        </button>
      </div>

      <div className="friends-content">
        {activeTab === 'friends' && (
          <FriendsList friends={friends} onRemove={handleRemove} />
        )}
        {activeTab === 'requests' && (
          <FriendRequests
            received={pendingReceived}
            sent={pendingSent}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onCancel={handleCancel}
          />
        )}
        {activeTab === 'find' && (
          <FindFriends
            user={user}
            allFriends={allFriends}
            onSendRequest={onSendRequest}
            onAccept={handleAccept}
          />
        )}
      </div>
    </div>
  );
}
