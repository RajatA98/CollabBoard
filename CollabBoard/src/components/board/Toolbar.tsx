interface ToolbarProps {
  onLogout?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function Toolbar({ onLogout, onUndo, onRedo, canUndo = false, canRedo = false }: ToolbarProps) {
  return (
    <div className="toolbar" data-testid="toolbar">
      <div className="toolbar-brand">CollabBoard</div>
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
