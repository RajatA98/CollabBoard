import { useRef, useState } from 'react';

type ShapeType = 'rectangle' | 'sticky' | 'text' | 'circle' | 'line' | 'arrow-single' | 'arrow-double' | 'triangle' | 'star' | 'frame';

interface ShapeSidebarProps {
  onShapeClick?: (shapeType: ShapeType) => void;
  /** Called when a shape drag starts or ends (for drop-zone feedback) */
  onDragStateChange?: (isDragging: boolean) => void;
  /** Controlled open state for the shapes submenu (e.g. close when canvas is clicked) */
  shapesPanelOpen?: boolean;
  onShapesPanelOpenChange?: (open: boolean) => void;
  /** Callback to toggle the AI command panel */
  onAIClick?: () => void;
  /** Whether the AI panel is currently open */
  aiPanelOpen?: boolean;
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

/** Circle icon for shapes panel */
const CirclePanelIcon = () => (
  <svg width="32" height="24" viewBox="0 0 40 30">
    <ellipse cx="20" cy="15" rx="16" ry="12" fill="#CE93D8" stroke="#9C27B0" strokeWidth="2" />
  </svg>
);

/** Triangle icon for shapes panel */
const TrianglePanelIcon = () => (
  <svg width="32" height="24" viewBox="0 0 40 30">
    <polygon points="20,2 2,28 38,28" fill="#81C784" stroke="#388E3C" strokeWidth="2" />
  </svg>
);

/** Star icon for shapes panel */
const StarPanelIcon = () => (
  <svg width="32" height="24" viewBox="0 0 40 30">
    <polygon points="20,2 24,12 36,12 27,19 30,28 20,22 10,28 13,19 4,12 16,12" fill="#FFB74D" stroke="#F57C00" strokeWidth="2" />
  </svg>
);

/** Line icon for shapes panel */
const LinePanelIcon = () => (
  <svg width="32" height="24" viewBox="0 0 40 30">
    <line x1="4" y1="26" x2="36" y2="4" stroke="#424242" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Single arrow icon for shapes panel */
const ArrowSinglePanelIcon = () => (
  <svg width="32" height="24" viewBox="0 0 40 30">
    <line x1="4" y1="26" x2="36" y2="4" stroke="#424242" strokeWidth="2" strokeLinecap="round" />
    <polyline points="28,4 36,4 36,12" fill="none" stroke="#424242" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Double arrow icon for shapes panel */
const ArrowDoublePanelIcon = () => (
  <svg width="32" height="24" viewBox="0 0 40 30">
    <line x1="4" y1="26" x2="36" y2="4" stroke="#424242" strokeWidth="2" strokeLinecap="round" />
    <polyline points="28,4 36,4 36,12" fill="none" stroke="#424242" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="12,26 4,26 4,18" fill="none" stroke="#424242" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Frame icon for shapes panel */
const FramePanelIcon = () => (
  <svg width="32" height="24" viewBox="0 0 40 30">
    <rect x="2" y="8" width="36" height="20" fill="rgba(51,102,255,0.1)" stroke="#3366ff" strokeWidth="2" />
    <rect x="2" y="2" width="16" height="7" fill="#3366ff" rx="1" />
  </svg>
);

/** Sparkle icon for AI assistant */
const AIIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.09 6.26L20 10.27l-4.91 3.82L16.18 22 12 18.27 7.82 22l1.09-7.91L4 10.27l5.91-1.01L12 2z" fill="#7C4DFF" stroke="#651FFF" />
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
  onAIClick,
  aiPanelOpen,
}) => {
  const didDragRef = useRef(false);
  const [shapesPanelOpenInternal, setShapesPanelOpenInternal] = useState(false);
  const shapesPanelOpen = shapesPanelOpenProp ?? shapesPanelOpenInternal;
  const setShapesPanelOpen = onShapesPanelOpenChange ?? setShapesPanelOpenInternal;

  const handleDragStart = (shapeType: ShapeType, e: React.DragEvent) => {
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

  const handleClick = (shapeType: ShapeType) => {
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

        {/* Frame – separate button (not in shapes panel) */}
        <TooltipButton
          label="Frame"
          shortcut="F"
          icon={<FramePanelIcon />}
          onClick={() => handleClick('frame')}
          draggable
          onDragStart={(e) => handleDragStart('frame', e)}
          onDragEnd={handleDragEnd}
          data-testid="shape-template-frame"
          data-shape-type="frame"
          aria-label="Frame"
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

        {/* AI Assistant */}
        <div className="shape-sidebar-divider" />
        <TooltipButton
          label="AI Assistant"
          icon={<AIIcon />}
          onClick={() => onAIClick?.()}
          data-testid="shape-bar-ai-btn"
          aria-label="AI Assistant"
          active={aiPanelOpen}
        />
      </div>

      {/* Shapes panel – to the right */}
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
          <div
            className="shape-panel-item"
            data-testid="shape-template-circle"
            data-shape-type="circle"
            draggable
            onClick={() => handleClick('circle')}
            onDragStart={(e) => handleDragStart('circle', e)}
            onDragEnd={handleDragEnd}
            role="button"
            aria-label="Circle"
          >
            <span className="shape-panel-icon">
              <CirclePanelIcon />
            </span>
          </div>
          <div
            className="shape-panel-item"
            data-testid="shape-template-triangle"
            data-shape-type="triangle"
            draggable
            onClick={() => handleClick('triangle')}
            onDragStart={(e) => handleDragStart('triangle', e)}
            onDragEnd={handleDragEnd}
            role="button"
            aria-label="Triangle"
          >
            <span className="shape-panel-icon">
              <TrianglePanelIcon />
            </span>
          </div>
          <div
            className="shape-panel-item"
            data-testid="shape-template-star"
            data-shape-type="star"
            draggable
            onClick={() => handleClick('star')}
            onDragStart={(e) => handleDragStart('star', e)}
            onDragEnd={handleDragEnd}
            role="button"
            aria-label="Star"
          >
            <span className="shape-panel-icon">
              <StarPanelIcon />
            </span>
          </div>
          <div
            className="shape-panel-item"
            data-testid="shape-template-line"
            data-shape-type="line"
            draggable
            onClick={() => handleClick('line')}
            onDragStart={(e) => handleDragStart('line', e)}
            onDragEnd={handleDragEnd}
            role="button"
            aria-label="Line"
          >
            <span className="shape-panel-icon">
              <LinePanelIcon />
            </span>
          </div>
          <div
            className="shape-panel-item"
            data-testid="shape-template-arrow-single"
            data-shape-type="arrow-single"
            draggable
            onClick={() => handleClick('arrow-single')}
            onDragStart={(e) => handleDragStart('arrow-single', e)}
            onDragEnd={handleDragEnd}
            role="button"
            aria-label="Single arrow"
          >
            <span className="shape-panel-icon">
              <ArrowSinglePanelIcon />
            </span>
          </div>
          <div
            className="shape-panel-item"
            data-testid="shape-template-arrow-double"
            data-shape-type="arrow-double"
            draggable
            onClick={() => handleClick('arrow-double')}
            onDragStart={(e) => handleDragStart('arrow-double', e)}
            onDragEnd={handleDragEnd}
            role="button"
            aria-label="Double arrow"
          >
            <span className="shape-panel-icon">
              <ArrowDoublePanelIcon />
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
