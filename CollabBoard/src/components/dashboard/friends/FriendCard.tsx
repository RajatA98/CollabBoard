interface FriendCardProps {
  displayName: string;
  username: string;
  avatarColor: string;
  children?: React.ReactNode;
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

export function FriendCard({ displayName, username, avatarColor, children }: FriendCardProps) {
  return (
    <div className="friend-card">
      <div className="friend-card-avatar" style={{ background: avatarColor }}>
        {getInitials(displayName)}
      </div>
      <div className="friend-card-info">
        <span className="friend-card-name">{displayName}</span>
        {username && <span className="friend-card-username">@{username}</span>}
      </div>
      <div className="friend-card-actions">
        {children}
      </div>
    </div>
  );
}
