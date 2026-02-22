import type { BoardMeta } from '../../types';

interface BoardCardProps {
  board: BoardMeta;
  currentUserId?: string;
  actionLabel: string;
  onAction: () => void;
  onDelete?: () => void;
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

export function BoardCard({ board, currentUserId, actionLabel, onAction, onDelete }: BoardCardProps) {
  const memberCount = board.members.length;
  const createdDate = new Date(board.createdAt).toLocaleDateString();
  const isShared = currentUserId && board.creatorId !== currentUserId;
  const isPrivate = board.visibility === 'private';

  const collaboratorUids = board.collaboratorUids ?? [];
  const displayCollabs = collaboratorUids.slice(0, 3);
  const extraCount = Math.max(0, collaboratorUids.length - 3);

  return (
    <div className="board-card" data-testid="board-card">
      <div className="board-card-header">
        <h3 className="board-card-name">{board.name}</h3>
        <div className="board-card-badges">
          {isShared && <span className="board-badge shared">Shared</span>}
          {isPrivate && <span className="board-badge private">Private</span>}
        </div>
      </div>
      <div className="board-card-info">
        <span className="board-card-creator">
          {isShared ? `Owner: ${board.creatorName}` : `Created by ${board.creatorName}`}
        </span>
        <span className="board-card-date">{createdDate}</span>
        <span className="board-card-members">
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </span>
      </div>
      {displayCollabs.length > 0 && (
        <div className="board-card-collab-stack">
          {displayCollabs.map((uid) => {
            const name = board.memberNames?.[uid] ?? uid.slice(0, 2);
            return (
              <div key={uid} className="board-card-collab-avatar" title={name}>
                {getInitials(name)}
              </div>
            );
          })}
          {extraCount > 0 && (
            <div className="board-card-collab-extra">+{extraCount}</div>
          )}
        </div>
      )}
      <div className="board-card-actions">
        <button className="board-card-action" onClick={onAction}>
          {actionLabel}
        </button>
        {onDelete && (
          <button
            type="button"
            className="board-card-delete"
            onClick={onDelete}
            aria-label="Delete board"
            data-testid="delete-board-btn"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
