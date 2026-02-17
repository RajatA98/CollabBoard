import type { PresenceData } from '../../types';

interface PresenceBarProps {
  onlineUsers: PresenceData[];
}

export function PresenceBar({ onlineUsers }: PresenceBarProps) {
  return (
    <div className="presence-bar">
      <span className="presence-count">{onlineUsers.length} online</span>
      <div className="presence-avatars">
        {onlineUsers.map((user, i) => (
          <div
            key={`${user.email}-${user.name}-${i}`}
            className="presence-avatar"
            style={{ backgroundColor: user.color }}
            title={user.name || user.email}
          >
            <span className="avatar-initial">{(user.name || user.email || '?').charAt(0).toUpperCase()}</span>
            <span className="avatar-name">{user.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
