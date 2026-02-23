import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useBoards } from '../../hooks/useBoards';
import { useSubscription } from '../../hooks/useSubscription';
import { BoardCard } from './BoardCard';
import { CreateBoardModal } from './CreateBoardModal';
import { ProfilePanel } from '../profile/ProfilePanel';
import { hashColor } from '../../utils/cursor';
import './Dashboard.css';

type Tab = 'my-boards' | 'join-board';

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const { myBoards, joinableBoards, loading, createBoard, joinBoard, deleteBoard } = useBoards(user);
  const { tier, aiCommandCount, subscriptionStatus, currentPeriodEnd } = useSubscription(user);
  const [activeTab, setActiveTab] = useState<Tab>('my-boards');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const navigate = useNavigate();

  const handleCreateBoard = useCallback(
    async (name: string) => {
      const board = await createBoard(name);
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

  const avatarColor = user ? hashColor(user.uid) : '#999';
  const initials = user ? getInitials(user.displayName || user.email) : '?';

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">CollabBoard</div>
        <div className="dashboard-user-area">
          {user && (
            <button
              type="button"
              className="dashboard-profile-btn"
              onClick={() => setProfilePanelOpen(true)}
              aria-label="Open profile"
              style={{ background: avatarColor }}
            >
              {initials}
            </button>
          )}
          {user && <span className="dashboard-user-name">{user.displayName || user.email}</span>}
          <button className="dashboard-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-top-bar">
          <div className="dashboard-tabs">
            <button
              className={`dashboard-tab ${activeTab === 'my-boards' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-boards')}
            >
              My Boards
            </button>
            <button
              className={`dashboard-tab ${activeTab === 'join-board' ? 'active' : ''}`}
              onClick={() => setActiveTab('join-board')}
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

        {loading ? (
          <div className="dashboard-loading">Loading boards...</div>
        ) : (
          <div className="dashboard-board-grid">
            {activeTab === 'my-boards' && (
              <>
                {myBoards.length === 0 ? (
                  <div className="dashboard-empty">
                    <p>You haven't joined any boards yet.</p>
                    <p>Create a new board or browse open boards in the Join Board tab.</p>
                  </div>
                ) : (
                  myBoards.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
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

            {activeTab === 'join-board' && (
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
                      actionLabel="Join"
                      onAction={() => handleJoinBoard(board.id)}
                    />
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateBoardModal
          onSubmit={handleCreateBoard}
          onCancel={() => setShowCreateModal(false)}
        />
      )}

      {user && (
        <ProfilePanel
          open={profilePanelOpen}
          onClose={() => setProfilePanelOpen(false)}
          user={user}
          tier={tier}
          aiCommandCount={aiCommandCount}
          subscriptionStatus={subscriptionStatus}
          currentPeriodEnd={currentPeriodEnd}
        />
      )}
    </div>
  );
}
