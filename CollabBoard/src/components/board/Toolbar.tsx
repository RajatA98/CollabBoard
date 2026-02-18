import { useNavigate } from 'react-router-dom';

interface ToolbarProps {
  onLogout?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function Toolbar({ onLogout, onUndo, onRedo, canUndo = false, canRedo = false }: ToolbarProps) {
  const navigate = useNavigate();

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
      <div
        className="toolbar-brand"
        onClick={() => navigate('/dashboard')}
        style={{ cursor: 'pointer' }}
        role="link"
        aria-label="Back to dashboard"
      >
        CollabBoard
      </div>
      <div className="toolbar-tools">
        {onUndo && (
          <button
            type="button"
            className="tool-btn"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo (⌘Z)"
            data-testid="toolbar-undo"
          >
            Undo <span className="toolbar-shortcut">⌘Z</span>
          </button>
        )}
        {onRedo && (
          <button
            type="button"
            className="tool-btn"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo (⌘⇧Z)"
            data-testid="toolbar-redo"
          >
            Redo <span className="toolbar-shortcut">⌘⇧Z</span>
          </button>
        )}
      </div>
      <div className="toolbar-actions">
        {onLogout && (
          <button className="tool-btn logout-btn" onClick={onLogout} aria-label="Logout">
            Logout
          </button>
        )}
      </div>
    </div>
  );
}
