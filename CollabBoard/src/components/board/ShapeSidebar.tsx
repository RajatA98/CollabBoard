import { useRef, useState } from 'react';

interface ShapeSidebarProps {
  onShapeClick?: (shapeType: 'rectangle' | 'sticky' | 'text') => void;
  /** Called when a shape drag starts or ends (for drop-zone feedback) */
  onDragStateChange?: (isDragging: boolean) => void;
  /** Controlled open state for the shapes submenu (e.g. close when canvas is clicked) */
  shapesPanelOpen?: boolean;
  onShapesPanelOpenChange?: (open: boolean) => void;
}

/** Icon-only sticky note (folded corner) for left bar */
const StickyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h14l4 4v12H4V4z" fill="#FFD54F" stroke="#FFA000" />
    <path d="M18 4v4h4" fill="none" stroke="#FFB300" />
  </svg>
);

/** Capital T for text tool */
const TextIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <text x="12" y="18" textAnchor="middle" dominantBaseline="alphabetic" fontSize="18" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor" stroke="none">
      T
    </text>
  </svg>
);

/** PlayStation-style 2x2: top-left square, top-right circle, bottom-left triangle, bottom-right diagonal arrow */
const ShapesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="6" height="6" rx="0.5" />
    <circle cx="17" cy="5" r="3" />
    <path d="M1 20l4-6 4 6H1z" />
    <path d="M12 20L18 14M18 14l-2 1.5M18 14l-1.5 2" />
  </svg>
);

/** Rectangle icon for shapes panel */
const RectanglePanelIcon = () => (
  <svg width="32" height="24" viewBox="0 0 40 30">
    <rect x="2" y="2" width="36" height="26" fill="#90CAF9" stroke="#2196F3" strokeWidth="2" rx="2" />
  </svg>
);

interface TooltipButtonProps {
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  'data-testid': string;
  'data-shape-type'?: string;
  'aria-label': string;
  active?: boolean;
}

function TooltipButton({
  label,
  shortcut,
  icon,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  'data-testid': dataTestId,
  'data-shape-type': dataShapeType,
  'aria-label': ariaLabel,
  active = false,
}: TooltipButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const common = {
    className: `shape-bar-btn ${active ? 'shape-bar-btn-active' : ''}`,
    onClick,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
    onMouseEnter: () => setShowTooltip(true),
    onMouseLeave: () => setShowTooltip(false),
  };
  const content = <span className="shape-bar-btn-icon">{icon}</span>;
  return (
    <div className="shape-bar-btn-wrap">
      {draggable ? (
        <div
          {...common}
          role="button"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          data-shape-type={dataShapeType}
        >
          {content}
        </div>
      ) : (
        <button type="button" {...common}>
          {content}
        </button>
      )}
      {showTooltip && (
        <div className="shape-bar-tooltip" role="tooltip">
          <span className="shape-bar-tooltip-label">{label}</span>
          {shortcut != null && (
            <span className="shape-bar-tooltip-shortcut">{shortcut}</span>
          )}
        </div>
      )}
    </div>
  );
}

export const ShapeSidebar: React.FC<ShapeSidebarProps> = ({
  onShapeClick,
  onDragStateChange,
  shapesPanelOpen: shapesPanelOpenProp,
  onShapesPanelOpenChange,
}) => {
  const didDragRef = useRef(false);
  const [shapesPanelOpenInternal, setShapesPanelOpenInternal] = useState(false);
  const shapesPanelOpen = shapesPanelOpenProp ?? shapesPanelOpenInternal;
  const setShapesPanelOpen = onShapesPanelOpenChange ?? setShapesPanelOpenInternal;

  const handleDragStart = (shapeType: 'rectangle' | 'sticky' | 'text', e: React.DragEvent) => {
    didDragRef.current = true;
    onDragStateChange?.(true);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('shape-type', shapeType);
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      e.dataTransfer.setDragImage(img, 0, 0);
    }
  };

  const handleDragEnd = () => {
    didDragRef.current = false;
    onDragStateChange?.(false);
  };

  const handleClick = (shapeType: 'rectangle' | 'sticky' | 'text') => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onShapeClick?.(shapeType);
  };

  const handleShapesButtonClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setShapesPanelOpen(!shapesPanelOpen);
  };

  return (
    <div className="shape-sidebar" data-testid="shape-sidebar" role="group" aria-label="Shape tools">
      <div className="shape-sidebar-tools">
        {/* Sticky note */}
        <TooltipButton
          label="Sticky note"
          icon={<StickyIcon />}
          onClick={() => handleClick('sticky')}
          draggable
          onDragStart={(e) => handleDragStart('sticky', e)}
          onDragEnd={handleDragEnd}
          data-testid="shape-template-sticky"
          data-shape-type="sticky"
          aria-label="Sticky note"
        />

        {/* Text */}
        <TooltipButton
          label="Text"
          icon={<TextIcon />}
          onClick={() => handleClick('text')}
          draggable
          onDragStart={(e) => handleDragStart('text', e)}
          onDragEnd={handleDragEnd}
          data-testid="shape-template-text"
          data-shape-type="text"
          aria-label="Text"
        />

        {/* Shapes – toggles panel, not draggable */}
        <TooltipButton
          label="Shapes and lines"
          icon={<ShapesIcon />}
          onClick={handleShapesButtonClick}
          data-testid="shape-bar-shapes-btn"
          aria-label="Shapes and lines"
          active={shapesPanelOpen}
        />
      </div>

      {/* Shapes panel – to the right, rectangle only */}
      {shapesPanelOpen && (
        <div className="shape-panel" data-testid="shape-panel" role="region" aria-label="Shapes and lines">
          <div
            className="shape-panel-item"
            data-testid="shape-template-rectangle"
            data-shape-type="rectangle"
            draggable
            onClick={() => handleClick('rectangle')}
            onDragStart={(e) => handleDragStart('rectangle', e)}
            onDragEnd={handleDragEnd}
            role="button"
            aria-label="Rectangle"
          >
            <span className="shape-panel-icon">
              <RectanglePanelIcon />
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
