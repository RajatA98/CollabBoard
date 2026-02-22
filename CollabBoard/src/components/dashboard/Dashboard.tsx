import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBoards, type BoardFilter } from '../../hooks/useBoards';
import { useFriends } from '../../hooks/useFriends';
import { useInvitations } from '../../hooks/useInvitations';
import { callInviteCollaborator } from '../../firebase/invitations';
import { DashboardSidebar, type DashboardSection } from './DashboardSidebar';
import { BoardCard } from './BoardCard';
import { CreateBoardModal } from './CreateBoardModal';
import { ProfileSettings } from './ProfileSettings';
import { UsernamePromptModal } from './UsernamePromptModal';
import { FriendsPage } from './friends/FriendsPage';
import { InvitationsPage } from './invitations/InvitationsPage';
import { useUserProfile } from '../../hooks/useUserProfile';
import type { InvitedUser } from '../shared/CollaboratorInvite';
import './Dashboard.css';

type BoardTab = 'my-boards' | 'join-board';

export function Dashboard() {
  const { user, logout } = useAuth();
  const { profile } = useUserProfile(user);
  const {
    myBoards, joinableBoards, loading, filter, setFilter,
    createBoard, joinBoard, deleteBoard,
  } = useBoards(user);
  const {
    friends, pendingReceived, pendingSent, pendingReceivedCount,
    allFriends, loading: friendsLoading,
    sendRequest, respond: respondFriend, remove: removeFriend,
  } = useFriends(user);
  const {
    pendingInvitations, pastInvitations, pendingCount: invitationCount,
    loading: invitationsLoading, respond: respondInvitation,
  } = useInvitations(user);

  const [activeSection, setActiveSection] = useState<DashboardSection>('boards');
  const [boardTab, setBoardTab] = useState<BoardTab>('my-boards');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(true);
  const navigate = useNavigate();

  const needsUsername = user && profile && !profile.username && showUsernamePrompt;

  const handleCreateBoard = useCallback(
    async (name: string, visibility: 'open' | 'private', invited: InvitedUser[]) => {
      const board = await createBoard(name, visibility);
      // Invite collaborators
      for (const u of invited) {
        try {
          await callInviteCollaborator(board.id, u.uid, u.role);
        } catch (err) {
          console.error('Failed to invite collaborator:', err);
        }
      }
      setShowCreateModal(false);
      navigate(`/board/${board.id}`);
    },
    [createBoard, navigate]
  );

  const handleOpenBoard = useCallback(
    (boardId: string) => {
      navigate(`/board/${boardId}`);
    },
    [navigate]
  );

  const handleJoinBoard = useCallback(
    async (boardId: string) => {
      await joinBoard(boardId);
      navigate(`/board/${boardId}`);
    },
    [joinBoard, navigate]
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleDeleteBoard = useCallback(
    async (boardId: string, boardName: string) => {
      if (!window.confirm(`Delete "${boardName}"? This cannot be undone.`)) return;
      try {
        await deleteBoard(boardId);
      } catch (err) {
        console.error('Failed to delete board:', err);
        window.alert('Failed to delete board. You may only delete boards you created.');
      }
    },
    [deleteBoard]
  );

  const filterButtons: { value: BoardFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'owned', label: 'Owned by me' },
    { value: 'shared', label: 'Shared with me' },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">CollabBoard</div>
        <div className="dashboard-user-area">
          {user && <span className="dashboard-user-name">{user.displayName || user.email}</span>}
          <button className="dashboard-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-body">
        {user && (
          <DashboardSidebar
            user={user}
            active={activeSection}
            onNavigate={setActiveSection}
            friendRequestCount={pendingReceivedCount}
            invitationCount={invitationCount}
            onProfileClick={() => setShowProfileSettings(true)}
          />
        )}

        <div className="dashboard-content">
          {/* Boards section */}
          {activeSection === 'boards' && (
            <>
              <div className="dashboard-top-bar">
                <div className="dashboard-tabs">
                  <button
                    className={`dashboard-tab ${boardTab === 'my-boards' ? 'active' : ''}`}
                    onClick={() => setBoardTab('my-boards')}
                  >
                    My Boards
                  </button>
                  <button
                    className={`dashboard-tab ${boardTab === 'join-board' ? 'active' : ''}`}
                    onClick={() => setBoardTab('join-board')}
                  >
                    Join Board
                  </button>
                </div>
                <button
                  className="dashboard-create-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  + Create Board
                </button>
              </div>

              {boardTab === 'my-boards' && (
                <div className="dashboard-filter-bar">
                  {filterButtons.map((fb) => (
                    <button
                      key={fb.value}
                      className={`dashboard-filter-btn ${filter === fb.value ? 'active' : ''}`}
                      onClick={() => setFilter(fb.value)}
                    >
                      {fb.label}
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="dashboard-loading">Loading boards...</div>
              ) : (
                <div className="dashboard-board-grid">
                  {boardTab === 'my-boards' && (
                    <>
                      {myBoards.length === 0 ? (
                        <div className="dashboard-empty">
                          <p>No boards found.</p>
                          <p>Create a new board or browse open boards in the Join Board tab.</p>
                        </div>
                      ) : (
                        myBoards.map((board) => (
                          <BoardCard
                            key={board.id}
                            board={board}
                            currentUserId={user?.uid}
                            actionLabel="Open"
                            onAction={() => handleOpenBoard(board.id)}
                            onDelete={
                              board.creatorId === user?.uid
                                ? () => handleDeleteBoard(board.id, board.name || 'Untitled')
                                : undefined
                            }
                          />
                        ))
                      )}
                    </>
                  )}

                  {boardTab === 'join-board' && (
                    <>
                      {joinableBoards.length === 0 ? (
                        <div className="dashboard-empty">
                          <p>No open boards available to join right now.</p>
                          <p>Create a new board to get started!</p>
                        </div>
                      ) : (
                        joinableBoards.map((board) => (
                          <BoardCard
                            key={board.id}
                            board={board}
                            currentUserId={user?.uid}
                            actionLabel="Join"
                            onAction={() => handleJoinBoard(board.id)}
                          />
                        ))
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Friends section */}
          {activeSection === 'friends' && user && (
            <FriendsPage
              user={user}
              friends={friends}
              pendingReceived={pendingReceived}
              pendingSent={pendingSent}
              allFriends={allFriends}
              loading={friendsLoading}
              onSendRequest={sendRequest}
              onRespond={respondFriend}
              onRemove={removeFriend}
            />
          )}

          {/* Invitations section */}
          {activeSection === 'invitations' && (
            <InvitationsPage
              pendingInvitations={pendingInvitations}
              pastInvitations={pastInvitations}
              loading={invitationsLoading}
              onRespond={respondInvitation}
            />
          )}
        </div>
      </div>

      {showCreateModal && user && (
        <CreateBoardModal
          user={user}
          friends={friends}
          allFriends={allFriends}
          onSubmit={handleCreateBoard}
          onCancel={() => setShowCreateModal(false)}
        />
      )}

      {showProfileSettings && user && (
        <ProfileSettings
          user={user}
          profile={profile}
          onClose={() => setShowProfileSettings(false)}
        />
      )}

      {needsUsername && (
        <UsernamePromptModal
          onDone={() => setShowUsernamePrompt(false)}
          onDismiss={() => setShowUsernamePrompt(false)}
        />
      )}
    </div>
  );
}
