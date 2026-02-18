import type { BoardMeta } from '../../types';

interface BoardCardProps {
  board: BoardMeta;
  actionLabel: string;
  onAction: () => void;
}

export function BoardCard({ board, actionLabel, onAction }: BoardCardProps) {
  const memberCount = board.members.length;
  const createdDate = new Date(board.createdAt).toLocaleDateString();

  return (
    <div className="board-card" data-testid="board-card">
      <div className="board-card-header">
        <h3 className="board-card-name">{board.name}</h3>
      </div>
      <div className="board-card-info">
        <span className="board-card-creator">Created by {board.creatorName}</span>
        <span className="board-card-date">{createdDate}</span>
        <span className="board-card-members">
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </span>
      </div>
      <button className="board-card-action" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
