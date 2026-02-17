import { useState } from 'react';

interface ToolbarProps {
  onAddRectangle?: () => void;
  onLogout?: () => void;
}

export function Toolbar({ onAddRectangle, onLogout }: ToolbarProps) {
  const [isClicked, setIsClicked] = useState(false);

  const handleRectangleClick = () => {
    console.log('🖱️ Rectangle button clicked in Toolbar', { onAddRectangle: !!onAddRectangle });
    setIsClicked(true);
    if (onAddRectangle) {
      onAddRectangle();
    } else {
      console.error('❌ onAddRectangle is not defined!');
    }
    setTimeout(() => setIsClicked(false), 200);
  };

  return (
    <div className="toolbar" data-testid="toolbar">
      <div className="toolbar-brand">CollabBoard</div>
      <div className="toolbar-tools">
        <button
          className={`tool-btn ${isClicked ? 'active' : ''}`}
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
