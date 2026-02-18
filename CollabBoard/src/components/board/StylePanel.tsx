import { useState, useEffect } from 'react';
import type { BoardObject } from '../../types';

interface StylePanelProps {
  selectedObject: BoardObject | null;
  onUpdate: (updates: Partial<BoardObject>) => void;
  liveTransform?: {
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
  } | null;
  onCollapse?: () => void;
}

const MIN_SIZE = 20;

export const StylePanel: React.FC<StylePanelProps> = ({
  selectedObject,
  onUpdate,
  liveTransform,
  onCollapse,
}) => {
  const [localValues, setLocalValues] = useState(() => ({
    width: selectedObject ? String(Math.round(selectedObject.width)) : '',
    height: selectedObject ? String(Math.round(selectedObject.height)) : '',
    x: selectedObject ? String(Math.round(selectedObject.x)) : '',
    y: selectedObject ? String(Math.round(selectedObject.y)) : '',
    color: selectedObject ? selectedObject.color : '',
  }));

  const [localRotation, setLocalRotation] = useState(() =>
    selectedObject ? String(Math.round(selectedObject.rotation || 0)) : ''
  );

  // Update local state when liveTransform or selectedObject changes
  useEffect(() => {
    if (!selectedObject) return;

    // Use live transform values if available, otherwise use selectedObject
    const displayValues = liveTransform || selectedObject;

    setLocalValues({
      width: String(Math.round(displayValues.width)),
      height: String(Math.round(displayValues.height)),
      x: String(Math.round(displayValues.x)),
      y: String(Math.round(displayValues.y)),
      color: selectedObject.color,
    });

    setLocalRotation(String(Math.round(displayValues.rotation || 0)));
  }, [selectedObject, liveTransform]);

  if (!selectedObject) {
    return null;
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setLocalValues((prev) => ({ ...prev, color: newColor }));
    onUpdate({ color: newColor });
  };

  const handleNumberChange = (
    field: 'width' | 'height' | 'x' | 'y',
    value: string
  ) => {
    setLocalValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumberBlur = (field: 'width' | 'height' | 'x' | 'y') => {
    const numValue = parseFloat(localValues[field]);
    
    if (isNaN(numValue)) {
      // Restore original value if invalid
      setLocalValues((prev) => ({
        ...prev,
        [field]: String(Math.round(selectedObject[field])),
      }));
      return;
    }

    // Apply constraints
    let finalValue = numValue;
    if (field === 'width' || field === 'height') {
      finalValue = Math.max(MIN_SIZE, numValue);
    }

    // Update if value changed
    if (finalValue !== selectedObject[field]) {
      onUpdate({ [field]: finalValue });
    }

    // Update local state with rounded value
    setLocalValues((prev) => ({
      ...prev,
      [field]: String(Math.round(finalValue)),
    }));
  };

  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="style-panel" data-testid="style-panel">
      <div className="style-panel-header">
        <h3>Style</h3>
        {onCollapse && (
          <button
            type="button"
            className="style-panel-collapse-btn"
            onClick={onCollapse}
            aria-label="Close style panel"
            data-testid="style-panel-collapse"
          >
            <span aria-hidden>›</span>
          </button>
        )}
      </div>

      <div className="style-panel-content">
        {/* Object Type */}
        <div className="property-group">
          <label className="property-label">Type</label>
          <div className="property-value">
            {selectedObject.type === 'rectangle' ? 'Rectangle' : selectedObject.type === 'sticky' ? 'Sticky Note' : 'Text'}
          </div>
        </div>

        {/* Color */}
        <div className="property-group">
          <label htmlFor="color-input" className="property-label">
            Color
          </label>
          <div className="color-input-wrapper">
            <input
              id="color-input"
              type="color"
              value={localValues.color}
              onChange={handleColorChange}
              className="color-input"
              aria-label="Color"
            />
            <input
              type="text"
              value={localValues.color}
              onChange={handleColorChange}
              className="color-hex-input"
              placeholder="#000000"
            />
          </div>
        </div>

        {/* Dimensions */}
        <div className="property-group">
          <label htmlFor="width-input" className="property-label">
            Width
          </label>
          <input
            id="width-input"
            type="number"
            value={localValues.width}
            onChange={(e) => handleNumberChange('width', e.target.value)}
            onBlur={() => handleNumberBlur('width')}
            onKeyDown={handleNumberKeyDown}
            className="property-input"
            aria-label="Width"
            min={MIN_SIZE}
          />
        </div>

        <div className="property-group">
          <label htmlFor="height-input" className="property-label">
            Height
          </label>
          <input
            id="height-input"
            type="number"
            value={localValues.height}
            onChange={(e) => handleNumberChange('height', e.target.value)}
            onBlur={() => handleNumberBlur('height')}
            onKeyDown={handleNumberKeyDown}
            className="property-input"
            aria-label="Height"
            min={MIN_SIZE}
          />
        </div>

        {/* Position */}
        <div className="property-group">
          <label htmlFor="x-input" className="property-label">
            X
          </label>
          <input
            id="x-input"
            type="number"
            value={localValues.x}
            onChange={(e) => handleNumberChange('x', e.target.value)}
            onBlur={() => handleNumberBlur('x')}
            onKeyDown={handleNumberKeyDown}
            className="property-input"
            aria-label="X"
          />
        </div>

        <div className="property-group">
          <label htmlFor="y-input" className="property-label">
            Y
          </label>
          <input
            id="y-input"
            type="number"
            value={localValues.y}
            onChange={(e) => handleNumberChange('y', e.target.value)}
            onBlur={() => handleNumberBlur('y')}
            onKeyDown={handleNumberKeyDown}
            className="property-input"
            aria-label="Y"
          />
        </div>

        {/* Rotation */}
        <div className="property-group">
          <label htmlFor="rotation-input" className="property-label">
            Rotation (°)
          </label>
          <input
            id="rotation-input"
            type="number"
            value={localRotation}
            onChange={(e) => setLocalRotation(e.target.value)}
            onBlur={() => {
              const numValue = parseFloat(localRotation);
              if (!isNaN(numValue)) {
                onUpdate({ rotation: numValue });
              } else {
                setLocalRotation(String(Math.round(selectedObject.rotation || 0)));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="property-input"
            aria-label="Rotation"
            min={-180}
            max={180}
          />
        </div>
      </div>
    </div>
  );
};
