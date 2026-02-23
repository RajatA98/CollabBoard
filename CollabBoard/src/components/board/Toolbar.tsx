import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hashColor } from '../../utils/cursor';
import type { AppUser } from '../../types';

interface ToolbarProps {
  boardName: string;
  onBoardNameChange: (name: string) => void;
  onLogout?: () => void;
  user?: AppUser | null;
  onProfileClick?: () => void;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Toolbar({
  boardName,
  onBoardNameChange,
  onLogout,
  user,
  onProfileClick,
}: ToolbarProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(boardName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    setEditValue(boardName === 'Untitled' ? '' : boardName);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]); // init edit value only when entering edit mode; boardName read once

  const handleSave = () => {
    const trimmed = editValue.trim();
    onBoardNameChange(trimmed === '' ? '' : trimmed);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditValue(boardName === 'Untitled' ? '' : boardName);
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  const avatarColor = user ? hashColor(user.uid) : '#999';
  const initials = user ? getInitials(user.displayName || user.email) : '?';

  return (
    <div className="toolbar" data-testid="toolbar">
      <button
        type="button"
        className="tool-btn toolbar-back-btn"
        onClick={() => navigate('/dashboard')}
        aria-label="Back to boards"
        data-testid="back-to-boards-btn"
      >
        ← Back to boards
      </button>
      <div className="toolbar-title-wrap">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="toolbar-title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            aria-label="Board name"
            data-testid="board-name-input"
          />
        ) : (
          <button
            type="button"
            className="toolbar-title"
            onClick={() => setIsEditing(true)}
            aria-label="Edit board name"
            data-testid="board-name"
            title="Click to rename"
          >
            {boardName}
          </button>
        )}
      </div>
      <div className="toolbar-actions">
        {user && onProfileClick && (
          <button
            type="button"
            className="profile-btn"
            onClick={onProfileClick}
            aria-label="Open profile"
            data-testid="profile-btn"
            style={{ background: avatarColor }}
          >
            {initials}
          </button>
        )}
        {onLogout && (
          <button className="tool-btn logout-btn" onClick={onLogout} aria-label="Logout">
            Logout
          </button>
        )}
      </div>
    </div>
  );
}
