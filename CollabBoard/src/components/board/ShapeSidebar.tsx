import { useRef, useState } from 'react';

interface ShapeSidebarProps {
  onShapeClick?: (shapeType: 'rectangle' | 'sticky' | 'text') => void;
}

interface ShapeTemplate {
  type: 'rectangle' | 'sticky' | 'text';
  label: string;
  icon: React.ReactNode;
}

const shapeTemplates: ShapeTemplate[] = [
  {
    type: 'rectangle',
    label: 'Rectangle',
    icon: (
      <svg width="40" height="30" viewBox="0 0 40 30">
        <rect
          x="2"
          y="2"
          width="36"
          height="26"
          fill="#90CAF9"
          stroke="#2196F3"
          strokeWidth="2"
          rx="2"
        />
      </svg>
    ),
  },
  {
    type: 'sticky',
    label: 'Sticky Note',
    icon: (
      <svg width="40" height="30" viewBox="0 0 40 30">
        <rect
          x="2"
          y="2"
          width="36"
          height="26"
          fill="#FFD54F"
          stroke="#FFA000"
          strokeWidth="2"
          rx="2"
        />
        <path
          d="M 32 28 L 38 28 L 38 22 Z"
          fill="#FFB300"
        />
        <text
          x="20"
          y="12"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#333"
          fontSize="7"
          fontWeight="500"
          fontFamily="system-ui, sans-serif"
        >
          Sticky
        </text>
        <text
          x="20"
          y="19"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#333"
          fontSize="7"
          fontWeight="500"
          fontFamily="system-ui, sans-serif"
        >
          Note
        </text>
      </svg>
    ),
  },
  {
    type: 'text',
    label: 'Text',
    icon: (
      <svg width="40" height="30" viewBox="0 0 40 30">
        <rect
          x="2"
          y="2"
          width="36"
          height="26"
          fill="none"
          stroke="#666"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          rx="2"
        />
        <text
          x="20"
          y="17"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#333"
          fontSize="14"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          T
        </text>
      </svg>
    ),
  },
];

const stickyTemplate = shapeTemplates.find((t) => t.type === 'sticky')!;
const rectangleTemplate = shapeTemplates.find((t) => t.type === 'rectangle')!;
const textTemplate = shapeTemplates.find((t) => t.type === 'text')!;

export const ShapeSidebar: React.FC<ShapeSidebarProps> = ({ onShapeClick }) => {
  const didDragRef = useRef(false);
  const [shapesOpen, setShapesOpen] = useState(false);

  const handleDragStart = (shapeType: 'rectangle' | 'sticky' | 'text', e: React.DragEvent) => {
    didDragRef.current = true;

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
  };

  const handleClick = (shapeType: 'rectangle' | 'sticky' | 'text') => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onShapeClick?.(shapeType);
  };

  return (
    <div className="shape-sidebar" data-testid="shape-sidebar" role="group" aria-label="Shape tools">
      <div className="shape-sidebar-tools">
        {/* Sticky note button – label on the yellow shape */}
        <div
          className="shape-template shape-template-sticky"
          data-testid="shape-template-sticky"
          data-shape-type="sticky"
          draggable
          onClick={() => handleClick('sticky')}
          onDragStart={(e) => handleDragStart('sticky', e)}
          onDragEnd={handleDragEnd}
          role="button"
          aria-label="Sticky note"
        >
          <div className="shape-icon">{stickyTemplate.icon}</div>
        </div>

        {/* Shapes dropdown */}
        <div className="shape-dropdown" role="region" aria-label="Shapes">
          <button
            type="button"
            className={`shape-dropdown-trigger ${shapesOpen ? 'shape-dropdown-trigger-open' : ''}`}
            onClick={() => setShapesOpen((o) => !o)}
            aria-expanded={shapesOpen}
            aria-label="Shapes"
            data-testid="shape-dropdown-trigger"
          >
            <span className="shape-dropdown-chevron" aria-hidden>▼</span>
            <span className="shape-dropdown-trigger-text">Shapes</span>
          </button>
          {shapesOpen && (
            <div className="shape-dropdown-panel" data-testid="shape-dropdown-panel">
              <div
                className="shape-template shape-template-icon-only"
                data-testid="shape-template-rectangle"
                data-shape-type="rectangle"
                draggable
                onClick={() => handleClick('rectangle')}
                onDragStart={(e) => handleDragStart('rectangle', e)}
                onDragEnd={handleDragEnd}
                role="button"
                aria-label="Rectangle"
              >
                <div className="shape-icon">{rectangleTemplate.icon}</div>
              </div>
              <div
                className="shape-template shape-template-icon-only"
                data-testid="shape-template-text"
                data-shape-type="text"
                draggable
                onClick={() => handleClick('text')}
                onDragStart={(e) => handleDragStart('text', e)}
                onDragEnd={handleDragEnd}
                role="button"
                aria-label="Text"
              >
                <div className="shape-icon">{textTemplate.icon}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
