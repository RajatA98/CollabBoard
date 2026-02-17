interface ToolbarProps {
  activeTool?: string;
  onToolChange?: (tool: string) => void;
  onLogout?: () => void;
}

export function Toolbar({ activeTool, onToolChange, onLogout }: ToolbarProps) {
  return (
    <div className="toolbar" data-testid="toolbar">
      <div className="toolbar-brand">CollabBoard</div>
      <div className="toolbar-tools">
        <button
          className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => onToolChange?.('select')}
          aria-label="Select"
        >
          Select
        </button>
        <button
          className={`tool-btn ${activeTool === 'sticky' ? 'active' : ''}`}
          onClick={() => onToolChange?.('sticky')}
          aria-label="Sticky Note"
        >
          Sticky Note
        </button>
        <button
          className={`tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
          onClick={() => onToolChange?.('rectangle')}
          aria-label="Rectangle"
        >
          Rectangle
        </button>
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
