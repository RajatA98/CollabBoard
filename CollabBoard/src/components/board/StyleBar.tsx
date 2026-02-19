import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { worldToScreen } from '../../utils/coordinates';
import type { BoardObject } from '../../types';

interface StyleBarProps {
  selectedObject: BoardObject;
  selectedCount: number;
  onUpdate: (updates: Partial<BoardObject>) => void;
  onDelete: () => void;
  liveTransform?: {
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
  } | null;
  viewport: { x: number; y: number; scaleX: number; scaleY: number };
}

const MIRO_COLORS = [
  '#3366FF', '#FF6B6B', '#FFC93D', '#4CAF50', '#9C27B0',
  '#FF9800', '#E91E63', '#FFFFFF', '#000000',
];

const FONT_FAMILIES = [
  { label: 'Sans Serif', value: "'Segoe UI', system-ui, sans-serif" },
  { label: 'Serif', value: "'Georgia', 'Times New Roman', serif" },
  { label: 'Mono', value: "'Monaco', 'Courier New', monospace" },
  { label: 'Handwriting', value: "'Segoe Print', 'Comic Sans MS', cursive" },
];

const SHAPE_TYPES = ['rectangle', 'circle', 'triangle', 'star', 'sticky'] as const;

const LINE_STYLES: { value: BoardObject['lineStyle']; label: string; preview: string }[] = [
  { value: 'solid', label: 'Solid', preview: '━━━' },
  { value: 'dashed', label: 'Dashed', preview: '╌╌╌' },
  { value: 'dotted', label: 'Dotted', preview: '⋯⋯⋯' },
];

// ── Inline SVG icons ────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M12.67 4v9.33a1.33 1.33 0 01-1.34 1.34H4.67a1.33 1.33 0 01-1.34-1.34V4h9.34z" />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="8" rx="6" ry="5.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function TriangleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L1.5 14h13L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function StickyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 2h9.5l2 2v10h-11.5V2z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12 2v2h2" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="5" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

const SHAPE_ICONS: Record<string, () => React.ReactNode> = {
  rectangle: RectIcon,
  circle: CircleIcon,
  triangle: TriangleIcon,
  star: StarIcon,
  sticky: StickyIcon,
};
const SHAPE_LABELS: Record<string, string> = {
  rectangle: 'Rectangle',
  circle: 'Circle',
  triangle: 'Triangle',
  star: 'Star',
  sticky: 'Sticky Note',
};

// ── Color Swatch Picker ─────────────────────────────────────────

function ColorSwatchPicker({
  color,
  onChange,
  label,
}: {
  color: string;
  onChange: (c: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(color);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(color);
  }, [color]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="sb-color-picker" ref={ref}>
      <button
        type="button"
        className="sb-color-swatch"
        style={{ backgroundColor: color }}
        onClick={() => setOpen(!open)}
        aria-label={label}
        title={label}
      />
      {open && (
        <div className="sb-color-popover" onMouseDown={(e) => e.stopPropagation()}>
          <div className="sb-color-grid">
            {MIRO_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`sb-color-option${c === color ? ' sb-color-option-active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => { onChange(c); setOpen(false); }}
                aria-label={c}
              />
            ))}
          </div>
          <div className="sb-color-hex-row">
            <span>#</span>
            <input
              type="text"
              className="sb-color-hex-input"
              value={hexInput.replace('#', '')}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                setHexInput('#' + v);
              }}
              onBlur={() => {
                if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
                  onChange(hexInput);
                } else {
                  setHexInput(color);
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              maxLength={6}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shape Switcher Dropdown ─────────────────────────────────────

function ShapeSwitcher({
  currentType,
  onChange,
}: {
  currentType: string;
  onChange: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const CurrentIcon = SHAPE_ICONS[currentType] || RectIcon;

  return (
    <div className="sb-dropdown" ref={ref}>
      <button
        type="button"
        className="sb-dropdown-trigger sb-dropdown-trigger-icon"
        onClick={() => setOpen(!open)}
        title={SHAPE_LABELS[currentType] || 'Switch shape'}
        data-testid="shape-switcher"
      >
        <CurrentIcon />
        <span className="sb-dropdown-arrow">▾</span>
      </button>
      {open && (
        <div className="sb-dropdown-menu">
          {SHAPE_TYPES.map((t) => {
            const Icon = SHAPE_ICONS[t] || RectIcon;
            return (
              <button
                key={t}
                type="button"
                className={`sb-dropdown-item${t === currentType ? ' sb-dropdown-item-active' : ''}`}
                onClick={() => { onChange(t); setOpen(false); }}
              >
                <Icon />
                <span>{SHAPE_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Line Style Dropdown ─────────────────────────────────────────

function LineStyleDropdown({
  value,
  onChange,
}: {
  value: BoardObject['lineStyle'];
  onChange: (s: NonNullable<BoardObject['lineStyle']>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = value || 'solid';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = LINE_STYLES.find((s) => s.value === current);

  return (
    <div className="sb-dropdown" ref={ref}>
      <button
        type="button"
        className="sb-dropdown-trigger"
        onClick={() => setOpen(!open)}
        title="Line style"
        data-testid="line-style-dropdown"
      >
        {currentLabel?.preview || '━━━'}
        <span className="sb-dropdown-arrow">▾</span>
      </button>
      {open && (
        <div className="sb-dropdown-menu">
          {LINE_STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`sb-dropdown-item${s.value === current ? ' sb-dropdown-item-active' : ''}`}
              onClick={() => { onChange(s.value!); setOpen(false); }}
            >
              <span className="sb-line-preview">{s.preview}</span> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Delete Button with Confirmation ─────────────────────────────

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirming) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setConfirming(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirming]);

  return (
    <div className="sb-delete-wrapper" ref={ref}>
      <button
        type="button"
        className="sb-btn sb-delete-btn"
        onClick={() => setConfirming(true)}
        aria-label="Delete"
        title="Delete"
        data-testid="style-bar-delete"
      >
        <TrashIcon />
      </button>
      {confirming && (
        <div className="sb-confirm-popover" data-testid="delete-confirm">
          <span>Delete?</span>
          <button
            type="button"
            className="sb-confirm-yes"
            onClick={() => { onDelete(); setConfirming(false); }}
          >
            Yes
          </button>
          <button
            type="button"
            className="sb-confirm-no"
            onClick={() => setConfirming(false)}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main StyleBar ───────────────────────────────────────────────

const TOOLBAR_GAP = 24;
const EDGE_PADDING = 8;
const BAR_HEIGHT = 44;

export function StyleBar({
  selectedObject,
  selectedCount,
  onUpdate,
  onDelete,
  liveTransform,
  viewport,
}: StyleBarProps) {
  const isMulti = selectedCount > 1;
  const isText = selectedObject.type === 'sticky' || selectedObject.type === 'text';
  const isLine = selectedObject.type === 'line';
  const isShape = ['rectangle', 'circle', 'triangle', 'star'].includes(selectedObject.type);

  const display = liveTransform || selectedObject;

  // Position the bar above the selected shape, centered horizontally
  const pos = useMemo(() => {
    const { x, y, width, height, rotation } = display;
    const rad = ((rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const centerWorldX = x + (width / 2) * cosR - (height / 2) * sinR;
    const centerWorldY = y + (width / 2) * sinR + (height / 2) * cosR;
    const screenPt = worldToScreen(centerWorldX, centerWorldY, viewport);
    const halfScreenH = (height * viewport.scaleY) / 2;
    return {
      left: screenPt.x,
      top: Math.max(EDGE_PADDING, screenPt.y - halfScreenH - TOOLBAR_GAP - BAR_HEIGHT),
    };
  }, [display, viewport]);

  // Local editing state for numeric fields
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const derivedX = String(Math.round(display.x));
  const derivedY = String(Math.round(-display.y));
  const derivedRotation = String(Math.round(display.rotation ?? 0));

  const getDisplayValue = (field: string, derived: string) =>
    focusedField === field ? editValue : derived;

  const handleFocus = (field: string, derived: string) => {
    setFocusedField(field);
    setEditValue(derived);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  }, []);

  const handleNumberBlur = useCallback((field: 'x' | 'y') => {
    setFocusedField(null);
    const num = parseFloat(editValue);
    if (isNaN(num)) return;
    const final = field === 'y' ? -num : num;
    if (final !== selectedObject[field]) {
      onUpdate({ [field]: final });
    }
  }, [editValue, selectedObject, onUpdate]);

  const handleRotationBlur = useCallback(() => {
    setFocusedField(null);
    const num = parseFloat(editValue);
    if (isNaN(num)) return;
    const clamped = Math.max(-180, Math.min(180, num));
    if (clamped !== (selectedObject.rotation ?? 0)) {
      onUpdate({ rotation: clamped });
    }
  }, [editValue, selectedObject, onUpdate]);

  // Shape type change
  const handleShapeChange = useCallback((newType: string) => {
    if (selectedObject.type === newType) return;
    const updates: Partial<BoardObject> = { type: newType as BoardObject['type'] };
    if (newType === 'sticky' && !selectedObject.text) updates.text = '';
    onUpdate(updates);
  }, [selectedObject, onUpdate]);

  // Arrow type
  const handleArrowType = useCallback((at: 'none' | 'single' | 'double') => {
    if (selectedObject.arrowType === at) return;
    onUpdate({ arrowType: at });
  }, [selectedObject, onUpdate]);

  // Font controls
  const toggleBold = useCallback(() => onUpdate({ bold: !selectedObject.bold }), [selectedObject, onUpdate]);
  const toggleItalic = useCallback(() => onUpdate({ italic: !selectedObject.italic }), [selectedObject, onUpdate]);
  const toggleUnderline = useCallback(() => onUpdate({ underline: !selectedObject.underline }), [selectedObject, onUpdate]);

  const derivedFontSize = String(selectedObject.fontSize || 16);

  const handleFontSizeBlur = useCallback(() => {
    setFocusedField(null);
    const num = parseInt(editValue, 10);
    if (!isNaN(num) && num >= 8 && num <= 200) {
      onUpdate({ fontSize: num });
    }
  }, [editValue, onUpdate]);

  const handleFontFamilyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ fontFamily: e.target.value });
  }, [onUpdate]);

  const currentFontFamily = selectedObject.fontFamily
    || (selectedObject.type === 'sticky'
      ? "'Segoe Print', 'Comic Sans MS', cursive"
      : "'Segoe UI', system-ui, sans-serif");

  // Dimensions
  const derivedW = String(Math.round(display.width));
  const derivedH = String(Math.round(display.height));

  const handleDimensionBlur = useCallback((field: 'width' | 'height') => {
    setFocusedField(null);
    const num = parseFloat(editValue);
    if (isNaN(num) || num < 20) return;
    if (num !== selectedObject[field]) {
      onUpdate({ [field]: num });
    }
  }, [editValue, selectedObject, onUpdate]);

  // Stroke width
  const handleStrokeWidthBlur = useCallback(() => {
    setFocusedField(null);
    const num = parseInt(editValue, 10);
    if (!isNaN(num) && num >= 1 && num <= 10) {
      onUpdate({ strokeWidth: num });
    }
  }, [editValue, onUpdate]);

  return (
    <div
      className="style-bar"
      data-testid="style-bar"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Shape Switcher (shapes only, not lines or text, single select only) */}
      {!isMulti && isShape && (
        <>
          <ShapeSwitcher currentType={selectedObject.type} onChange={handleShapeChange} />
          <div className="sb-divider" />
        </>
      )}

      {/* Connector / Arrow type (lines only) */}
      {!isMulti && isLine && (
        <>
          <div className="sb-group">
            <button
              type="button"
              className={`sb-btn${(selectedObject.arrowType ?? 'none') === 'none' ? ' sb-btn-active' : ''}`}
              onClick={() => handleArrowType('none')}
              title="Line"
            >
              ─
            </button>
            <button
              type="button"
              className={`sb-btn${selectedObject.arrowType === 'single' ? ' sb-btn-active' : ''}`}
              onClick={() => handleArrowType('single')}
              title="Arrow"
            >
              →
            </button>
            <button
              type="button"
              className={`sb-btn${selectedObject.arrowType === 'double' ? ' sb-btn-active' : ''}`}
              onClick={() => handleArrowType('double')}
              title="Double arrow"
            >
              ↔
            </button>
          </div>
          <div className="sb-divider" />
        </>
      )}

      {/* Fill / Text color: text box = text color only; sticky = fill + text color; shapes = fill */}
      <ColorSwatchPicker
        color={
          selectedObject.type === 'text'
            ? (selectedObject.textColor ?? '#333333')
            : selectedObject.color
        }
        onChange={(c) =>
          selectedObject.type === 'text'
            ? onUpdate({ textColor: c })
            : onUpdate({ color: c })
        }
        label={
          selectedObject.type === 'text'
            ? 'Text color'
            : isLine
              ? 'Stroke color'
              : isShape
                ? 'Fill color'
                : 'Fill color'
        }
      />
      {/* Text color for sticky note (separate from fill) */}
      {!isMulti && selectedObject.type === 'sticky' && (
        <>
          <div className="sb-divider" />
          <ColorSwatchPicker
            color={selectedObject.textColor ?? '#333333'}
            onChange={(c) => onUpdate({ textColor: c })}
            label="Text color"
          />
        </>
      )}

      {/* Stroke width for shapes (no separate stroke color) */}
      {!isMulti && isShape && (
        <>
          <div className="sb-divider" />
          <div className="sb-field">
            <label title="Stroke width">Sw</label>
            <input
              type="number"
              className="sb-input sb-input-sm"
              value={getDisplayValue('strokeWidth', String(selectedObject.strokeWidth ?? 1))}
              onFocus={() => handleFocus('strokeWidth', String(selectedObject.strokeWidth ?? 1))}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleStrokeWidthBlur}
              onKeyDown={handleKeyDown}
              min={1}
              max={10}
              aria-label="Stroke width"
              title="Stroke width"
            />
          </div>
        </>
      )}

      {/* Stroke width + line style for lines */}
      {!isMulti && isLine && (
        <>
          <div className="sb-field">
            <label>W</label>
            <input
              type="number"
              className="sb-input sb-input-sm"
              value={getDisplayValue('strokeWidth', String(selectedObject.strokeWidth ?? 2))}
              onFocus={() => handleFocus('strokeWidth', String(selectedObject.strokeWidth ?? 2))}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleStrokeWidthBlur}
              onKeyDown={handleKeyDown}
              min={1}
              max={10}
              aria-label="Stroke width"
              title="Stroke width"
            />
          </div>
          <LineStyleDropdown
            value={selectedObject.lineStyle}
            onChange={(s) => onUpdate({ lineStyle: s })}
          />
        </>
      )}

      {/* Font controls (text objects only) */}
      {isText && (
        <>
          <div className="sb-divider" />
          <div className="sb-group">
            <select
              className="sb-font-select"
              value={currentFontFamily}
              onChange={handleFontFamilyChange}
              aria-label="Font family"
              title="Font family"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <div className="sb-field">
              <input
                type="number"
                className="sb-input sb-input-sm"
                value={getDisplayValue('fontSize', derivedFontSize)}
                onFocus={() => handleFocus('fontSize', derivedFontSize)}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleFontSizeBlur}
                onKeyDown={handleKeyDown}
                min={8}
                max={200}
                aria-label="Font size"
                title="Font size"
              />
            </div>
            <button
              type="button"
              className={`sb-format-btn${selectedObject.bold ? ' sb-format-btn-active' : ''}`}
              onClick={toggleBold}
              aria-label="Bold"
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`sb-format-btn${selectedObject.italic ? ' sb-format-btn-active' : ''}`}
              onClick={toggleItalic}
              aria-label="Italic"
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`sb-format-btn${selectedObject.underline ? ' sb-format-btn-active' : ''}`}
              onClick={toggleUnderline}
              aria-label="Underline"
              title="Underline (Ctrl+U)"
            >
              <span style={{ textDecoration: 'underline' }}>U</span>
            </button>
          </div>
        </>
      )}

      <div className="sb-divider" />

      {/* Dimensions + Coordinates (single select only) */}
      {!isMulti && (
        <div className="sb-group">
          {!isLine && (
            <>
              <div className="sb-field">
                <label>W</label>
                <input
                  type="number"
                  className="sb-input"
                  value={getDisplayValue('width', derivedW)}
                  onFocus={() => handleFocus('width', derivedW)}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleDimensionBlur('width')}
                  onKeyDown={handleKeyDown}
                  min={20}
                  aria-label="Width"
                />
              </div>
              <div className="sb-field">
                <label>H</label>
                <input
                  type="number"
                  className="sb-input"
                  value={getDisplayValue('height', derivedH)}
                  onFocus={() => handleFocus('height', derivedH)}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleDimensionBlur('height')}
                  onKeyDown={handleKeyDown}
                  min={20}
                  aria-label="Height"
                />
              </div>
            </>
          )}
          <div className="sb-field">
            <label>X</label>
            <input
              type="number"
              className="sb-input"
              value={getDisplayValue('x', derivedX)}
              onFocus={() => handleFocus('x', derivedX)}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleNumberBlur('x')}
              onKeyDown={handleKeyDown}
              aria-label="X"
            />
          </div>
          <div className="sb-field">
            <label>Y</label>
            <input
              type="number"
              className="sb-input"
              value={getDisplayValue('y', derivedY)}
              onFocus={() => handleFocus('y', derivedY)}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleNumberBlur('y')}
              onKeyDown={handleKeyDown}
              aria-label="Y"
            />
          </div>
          {!isLine && (
            <div className="sb-field">
              <label title="Rotation">°</label>
              <input
                type="number"
                className="sb-input sb-input-sm"
                value={getDisplayValue('rotation', derivedRotation)}
                onFocus={() => handleFocus('rotation', derivedRotation)}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleRotationBlur}
                onKeyDown={handleKeyDown}
                min={-180}
                max={180}
                aria-label="Rotation"
                title="Rotation (degrees)"
              />
            </div>
          )}
        </div>
      )}

      <div className="sb-divider" />

      {/* Delete */}
      <DeleteButton onDelete={onDelete} />
    </div>
  );
}
