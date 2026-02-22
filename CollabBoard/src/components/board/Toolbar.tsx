import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ToolbarProps {
  boardName: string;
  onBoardNameChange: (name: string) => void;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  isViewer?: boolean;
}

export function Toolbar({
  boardName,
  onBoardNameChange,
  onLogout,
  onSettingsClick,
  isViewer,
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
        {isViewer && <span className="toolbar-viewer-badge">View Only</span>}
      </div>
      <div className="toolbar-actions">
        {onSettingsClick && (
          <button
            type="button"
            className="tool-btn toolbar-settings-btn"
            onClick={onSettingsClick}
            aria-label="Board settings"
            title="Board settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
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
