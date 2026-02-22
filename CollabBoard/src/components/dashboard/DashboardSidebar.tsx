import type { AppUser } from '../../types';

export type DashboardSection = 'boards' | 'friends' | 'invitations';

interface DashboardSidebarProps {
  user: AppUser;
  active: DashboardSection;
  onNavigate: (section: DashboardSection) => void;
  friendRequestCount: number;
  invitationCount: number;
  onProfileClick: () => void;
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

export function DashboardSidebar({
  user,
  active,
  onNavigate,
  friendRequestCount,
  invitationCount,
  onProfileClick,
}: DashboardSidebarProps) {
  const avatarColor = user.avatarColor ?? '#667eea';
  const displayName = user.displayName || user.email;

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${active === 'boards' ? 'active' : ''}`}
          onClick={() => onNavigate('boards')}
        >
          <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>Boards</span>
        </button>

        <button
          className={`sidebar-nav-item ${active === 'friends' ? 'active' : ''}`}
          onClick={() => onNavigate('friends')}
        >
          <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Friends</span>
          {friendRequestCount > 0 && (
            <span className="sidebar-badge">{friendRequestCount}</span>
          )}
        </button>

        <button
          className={`sidebar-nav-item ${active === 'invitations' ? 'active' : ''}`}
          onClick={() => onNavigate('invitations')}
        >
          <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 7L2 7" />
          </svg>
          <span>Invitations</span>
          {invitationCount > 0 && (
            <span className="sidebar-badge">{invitationCount}</span>
          )}
        </button>
      </div>

      <div className="sidebar-user" onClick={onProfileClick}>
        <div className="sidebar-user-avatar" style={{ background: avatarColor }}>
          {getInitials(displayName)}
        </div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">{displayName}</span>
          {user.username && (
            <span className="sidebar-user-username">@{user.username}</span>
          )}
        </div>
      </div>
    </aside>
  );
}
