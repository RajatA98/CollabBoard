import type { PresenceData, CursorData } from '../../types';

interface PresenceBarProps {
  onlineUsers: PresenceData[];
  cursors?: Record<string, CursorData>;
  onJumpToCursor?: (userId: string) => void;
}

export function PresenceBar({ onlineUsers, cursors = {}, onJumpToCursor }: PresenceBarProps) {
  return (
    <div className="presence-bar">
      <span className="presence-count">{onlineUsers.length} online</span>
      <div className="presence-avatars">
        {onlineUsers.map((user, i) => {
          const canJump = !!(user.userId && cursors[user.userId] && i > 0);
          return (
            <div
              key={`${user.email}-${user.name}-${i}`}
              className={`presence-avatar${canJump ? ' jumpable' : ''}`}
              style={{ backgroundColor: user.color }}
              title={canJump ? `Jump to ${user.name || user.email}'s cursor` : (user.name || user.email)}
              onClick={canJump ? () => onJumpToCursor?.(user.userId!) : undefined}
            >
              <span className="avatar-initial">{(user.name || user.email || '?').charAt(0).toUpperCase()}</span>
              <span className="avatar-name">{user.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
