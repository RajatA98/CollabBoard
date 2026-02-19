interface UndoRedoClearPanelProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  clearDisabled: boolean;
}

/** Curved arrow left (undo) */
const UndoIcon = ({ disabled }: { disabled: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10h10a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H3" opacity={disabled ? 0.4 : 1} />
    <path d="M3 10l4-4M3 10l4 4" opacity={disabled ? 0.4 : 1} />
  </svg>
);

/** Curved arrow right (redo) */
const RedoIcon = ({ disabled }: { disabled: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10H11a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h10" opacity={disabled ? 0.4 : 1} />
    <path d="M21 10l-4-4M21 10l-4 4" opacity={disabled ? 0.4 : 1} />
  </svg>
);

export function UndoRedoClearPanel({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  clearDisabled,
}: UndoRedoClearPanelProps) {
  return (
    <div className="undo-redo-clear-panel" data-testid="undo-redo-clear-panel" role="group" aria-label="Undo, redo, clear">
      <button
        type="button"
        className="undo-redo-clear-panel-btn"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo (⌘Z)"
        data-testid="toolbar-undo"
        title="Undo"
      >
        <UndoIcon disabled={!canUndo} />
      </button>
      <button
        type="button"
        className="undo-redo-clear-panel-btn"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo (⌘⇧Z)"
        data-testid="toolbar-redo"
        title="Redo"
      >
        <RedoIcon disabled={!canRedo} />
      </button>
      <button
        type="button"
        className="undo-redo-clear-panel-btn undo-redo-clear-panel-clear"
        onClick={onClear}
        disabled={clearDisabled}
        aria-label="Clear board"
        data-testid="clear-board-btn"
        title="Clear board"
      >
        Clear
      </button>
    </div>
  );
}
