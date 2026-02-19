import { useState, useMemo, useRef } from 'react';
import { worldToScreen } from '../../utils/coordinates';
import type { BoardObject } from '../../types';

interface FloatingToolbarProps {
  selectedObject: BoardObject;
  onUpdate: (updates: Partial<BoardObject>) => void;
  liveTransform?: {
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
  } | null;
  viewport: { x: number; y: number; scaleX: number; scaleY: number };
}

const TOOLBAR_GAP = 12;
const EDGE_PADDING = 8;

const FONT_FAMILIES = [
  { label: 'Sans Serif', value: "'Segoe UI', system-ui, sans-serif" },
  { label: 'Serif', value: "'Georgia', 'Times New Roman', serif" },
  { label: 'Mono', value: "'Monaco', 'Courier New', monospace" },
  { label: 'Handwriting', value: "'Segoe Print', 'Comic Sans MS', cursive" },
];

// ── Inline SVG icons (16x16) ────────────────────────────────────────────

const RectIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3" width="13" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const CircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <ellipse cx="8" cy="8" rx="6" ry="5.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const StickyNoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 2h10l2 2v10H2V2z" stroke="currentColor" strokeWidth="1.2" />
    <path d="M12 2v2h2" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
const LineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const ArrowSingleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polyline points="10,2 14,2 14,6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowDoubleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polyline points="10,2 14,2 14,6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="6,14 2,14 2,10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function FloatingToolbar({
  selectedObject,
  onUpdate,
  liveTransform,
  viewport,
}: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  const isTextType = selectedObject.type === 'sticky' || selectedObject.type === 'text';
  const isLineType = selectedObject.type === 'line';

  // ── Derived display values from props (no effects needed) ──────────
  const display = liveTransform || selectedObject;
  const derivedX = String(Math.round(display.x));
  const derivedY = String(Math.round(-display.y));
  const derivedRotation = String(Math.round(display.rotation || 0));
  const derivedFontSize = String(selectedObject.fontSize || 16);

  // Track which field is focused; use local state only while editing
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const getDisplayValue = (field: string, derived: string) =>
    focusedField === field ? editValue : derived;

  const handleFocus = (field: string, derived: string) => {
    setFocusedField(field);
    setEditValue(derived);
  };

  const handleEditChange = (value: string) => {
    setEditValue(value);
  };

  // ── Positioning via useMemo (no ref reads — CSS handles centering) ──
  const pos = useMemo(() => {
    const { x, y, width, height, rotation } = display;

    const rad = (rotation * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const centerWorldX = x + (width / 2) * cosR - (height / 2) * sinR;
    const centerWorldY = y + (width / 2) * sinR + (height / 2) * cosR;

    const screenPt = worldToScreen(centerWorldX, centerWorldY, viewport);
    const halfScreenH = (height * viewport.scaleY) / 2;

    // CSS transform: translateX(-50%) handles horizontal centering
    const left = screenPt.x;
    const top = Math.max(EDGE_PADDING, screenPt.y - halfScreenH - TOOLBAR_GAP - 44);

    return { left, top };
  }, [display, viewport]);

  // ── Handlers ───────────────────────────────────────────────────────

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ color: e.target.value });
  };

  const handleNumberBlur = (field: 'x' | 'y') => {
    setFocusedField(null);
    const numValue = parseFloat(editValue);
    if (isNaN(numValue)) return;
    let finalValue = numValue;
    if (field === 'y') finalValue = -numValue;
    if (finalValue !== selectedObject[field]) {
      onUpdate({ [field]: finalValue });
    }
  };

  const handleRotationBlur = () => {
    setFocusedField(null);
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      onUpdate({ rotation: numValue });
    }
  };

  const handleFontSizeBlur = () => {
    setFocusedField(null);
    const numValue = parseInt(editValue, 10);
    if (!isNaN(numValue) && numValue >= 8 && numValue <= 200) {
      onUpdate({ fontSize: numValue });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  // ── Shape type change ──────────────────────────────────────────────

  const handleShapeTypeChange = (newType: 'rectangle' | 'circle' | 'sticky') => {
    if (selectedObject.type === newType) return;
    const updates: Partial<BoardObject> = { type: newType };
    if (newType === 'sticky' && !selectedObject.text) {
      updates.text = '';
    }
    onUpdate(updates);
  };

  const handleArrowTypeChange = (arrowType: 'none' | 'single' | 'double') => {
    if (selectedObject.arrowType === arrowType) return;
    onUpdate({ arrowType });
  };

  // ── Font controls ──────────────────────────────────────────────────

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ fontFamily: e.target.value });
  };

  const toggleBold = () => onUpdate({ bold: !selectedObject.bold });
  const toggleItalic = () => onUpdate({ italic: !selectedObject.italic });
  const toggleUnderline = () => onUpdate({ underline: !selectedObject.underline });

  const currentFontFamily = selectedObject.fontFamily
    || (selectedObject.type === 'sticky'
      ? "'Segoe Print', 'Comic Sans MS', cursive"
      : "'Segoe UI', system-ui, sans-serif");

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div
      ref={toolbarRef}
      className="floating-toolbar"
      data-testid="floating-toolbar"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Shape / Line type selector */}
      {!isTextType && (
        <>
          <div className="floating-toolbar-group">
            {isLineType ? (
              <>
                <button
                  type="button"
                  className={`floating-toolbar-type-btn${selectedObject.arrowType === 'none' || !selectedObject.arrowType ? ' floating-toolbar-type-btn-active' : ''}`}
                  onClick={() => handleArrowTypeChange('none')}
                  aria-label="Line"
                  title="Line"
                >
                  <LineIcon />
                </button>
                <button
                  type="button"
                  className={`floating-toolbar-type-btn${selectedObject.arrowType === 'single' ? ' floating-toolbar-type-btn-active' : ''}`}
                  onClick={() => handleArrowTypeChange('single')}
                  aria-label="Single arrow"
                  title="Single arrow"
                >
                  <ArrowSingleIcon />
                </button>
                <button
                  type="button"
                  className={`floating-toolbar-type-btn${selectedObject.arrowType === 'double' ? ' floating-toolbar-type-btn-active' : ''}`}
                  onClick={() => handleArrowTypeChange('double')}
                  aria-label="Double arrow"
                  title="Double arrow"
                >
                  <ArrowDoubleIcon />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`floating-toolbar-type-btn${selectedObject.type === 'rectangle' ? ' floating-toolbar-type-btn-active' : ''}`}
                  onClick={() => handleShapeTypeChange('rectangle')}
                  aria-label="Rectangle"
                  title="Rectangle"
                >
                  <RectIcon />
                </button>
                <button
                  type="button"
                  className={`floating-toolbar-type-btn${selectedObject.type === 'circle' ? ' floating-toolbar-type-btn-active' : ''}`}
                  onClick={() => handleShapeTypeChange('circle')}
                  aria-label="Circle"
                  title="Circle"
                >
                  <CircleIcon />
                </button>
                <button
                  type="button"
                  className={`floating-toolbar-type-btn${selectedObject.type === 'sticky' ? ' floating-toolbar-type-btn-active' : ''}`}
                  onClick={() => handleShapeTypeChange('sticky')}
                  aria-label="Sticky note"
                  title="Sticky note"
                >
                  <StickyNoteIcon />
                </button>
              </>
            )}
          </div>
          <div className="floating-toolbar-divider" />
        </>
      )}

      {/* Color */}
      <div className="floating-toolbar-group">
        <input
          type="color"
          value={selectedObject.color}
          onChange={handleColorChange}
          className="floating-toolbar-color"
          aria-label="Color"
          title="Color"
        />
      </div>

      <div className="floating-toolbar-divider" />

      {/* X / Y / Rotation */}
          <div className="floating-toolbar-group">
            <div className="floating-toolbar-field">
              <label>X</label>
              <input
                type="number"
                value={getDisplayValue('x', derivedX)}
                onFocus={() => handleFocus('x', derivedX)}
                onChange={(e) => handleEditChange(e.target.value)}
                onBlur={() => handleNumberBlur('x')}
                onKeyDown={handleKeyDown}
                className="floating-toolbar-input"
                aria-label="X"
              />
            </div>
            <div className="floating-toolbar-field">
              <label>Y</label>
              <input
                type="number"
                value={getDisplayValue('y', derivedY)}
                onFocus={() => handleFocus('y', derivedY)}
                onChange={(e) => handleEditChange(e.target.value)}
                onBlur={() => handleNumberBlur('y')}
                onKeyDown={handleKeyDown}
                className="floating-toolbar-input"
                aria-label="Y"
              />
            </div>
            <div className="floating-toolbar-field">
              <label>°</label>
              <input
                type="number"
                value={getDisplayValue('rotation', derivedRotation)}
                onFocus={() => handleFocus('rotation', derivedRotation)}
                onChange={(e) => handleEditChange(e.target.value)}
                onBlur={handleRotationBlur}
                onKeyDown={handleKeyDown}
                className="floating-toolbar-input"
                aria-label="Rotation"
                min={-180}
                max={180}
              />
            </div>
          </div>

          {/* Font controls (text/sticky only) */}
          {isTextType && (
            <>
              <div className="floating-toolbar-divider" />
              <div className="floating-toolbar-group">
                <select
                  className="floating-toolbar-font-select"
                  value={currentFontFamily}
                  onChange={handleFontFamilyChange}
                  aria-label="Font family"
                  title="Font family"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <div className="floating-toolbar-field">
                  <input
                    type="number"
                    value={getDisplayValue('fontSize', derivedFontSize)}
                    onFocus={() => handleFocus('fontSize', derivedFontSize)}
                    onChange={(e) => handleEditChange(e.target.value)}
                    onBlur={handleFontSizeBlur}
                    onKeyDown={handleKeyDown}
                    className="floating-toolbar-input floating-toolbar-input-sm"
                    aria-label="Font size"
                    title="Font size"
                    min={8}
                    max={200}
                  />
                </div>
                <button
                  type="button"
                  className={`floating-toolbar-format-btn${selectedObject.bold ? ' floating-toolbar-format-btn-active' : ''}`}
                  onClick={toggleBold}
                  aria-label="Bold"
                  title="Bold"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  className={`floating-toolbar-format-btn${selectedObject.italic ? ' floating-toolbar-format-btn-active' : ''}`}
                  onClick={toggleItalic}
                  aria-label="Italic"
                  title="Italic"
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  className={`floating-toolbar-format-btn${selectedObject.underline ? ' floating-toolbar-format-btn-active' : ''}`}
                  onClick={toggleUnderline}
                  aria-label="Underline"
                  title="Underline"
                >
                  <span style={{ textDecoration: 'underline' }}>U</span>
                </button>
              </div>
            </>
          )}
    </div>
  );
}
