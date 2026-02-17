import { useState } from 'react';

interface ToolbarProps {
  onAddRectangle?: () => void;
  onAddStickyNote?: () => void;
  onLogout?: () => void;
}

export function Toolbar({ onAddRectangle, onAddStickyNote, onLogout }: ToolbarProps) {
  const [clickedButton, setClickedButton] = useState<string | null>(null);

  const handleRectangleClick = () => {
    console.log('🖱️ Rectangle button clicked in Toolbar');
    setClickedButton('rectangle');
    onAddRectangle?.();
    setTimeout(() => setClickedButton(null), 200);
  };

  const handleStickyNoteClick = () => {
    console.log('🖱️ Sticky Note button clicked in Toolbar');
    setClickedButton('sticky');
    onAddStickyNote?.();
    setTimeout(() => setClickedButton(null), 200);
  };

  return (
    <div className="toolbar" data-testid="toolbar">
      <div className="toolbar-brand">CollabBoard</div>
      <div className="toolbar-tools">
        <button
          className={`tool-btn ${clickedButton === 'sticky' ? 'active' : ''}`}
          onClick={handleStickyNoteClick}
          aria-label="Sticky Note"
        >
          Sticky Note
        </button>
        <button
          className={`tool-btn ${clickedButton === 'rectangle' ? 'active' : ''}`}
          onClick={handleRectangleClick}
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
