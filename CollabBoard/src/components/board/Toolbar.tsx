import { useNavigate } from 'react-router-dom';

interface ToolbarProps {
  onLogout?: () => void;
}

export function Toolbar({ onLogout }: ToolbarProps) {
  const navigate = useNavigate();

  return (
    <div className="toolbar" data-testid="toolbar">
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
        {/* Shape tools moved to sidebar */}
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
