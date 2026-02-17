import { Group, Rect, Text } from 'react-konva';
import type { BoardObject } from '../../types';

interface DimensionLabelProps {
  object: BoardObject;
  transformMode: 'idle' | 'resize' | 'rotate';
  liveTransform?: {
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
  } | null;
}

const DIMENSION_FONT_SIZE = 12;
const DIMENSION_FILL = '#333';
const DIMENSION_LABEL_PADDING = 6;
const DIMENSION_BG_FILL = 'rgba(255, 255, 255, 0.9)';

export function DimensionLabel({ object, transformMode, liveTransform }: DimensionLabelProps) {
  // Use live values during transform, fallback to object values
  const width = liveTransform?.width ?? object.width;
  const height = liveTransform?.height ?? object.height;
  const rotation = liveTransform?.rotation ?? (object.rotation || 0);
  const x = liveTransform?.x ?? object.x;
  const y = liveTransform?.y ?? object.y;

  // Compute visual center in layer coords so the label stays glued to the object
  // when rotated (center in local rect is width/2, height/2; transform to world)
  const rad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const centerX = x + (width / 2) * cosR - (height / 2) * sinR;
  const centerY = y + (width / 2) * sinR + (height / 2) * cosR;

  // Show rotation angle when rotating, otherwise show dimensions
  const labelText =
    transformMode === 'rotate'
      ? `${Math.round(rotation)}°`
      : `${Math.round(width)} × ${Math.round(height)}`;

  // Approximate text width for centering (chars * ~7 at 12px font)
  const dimensionTextWidth = Math.max(60, labelText.length * 7);
  const dimensionLabelWidth = dimensionTextWidth + DIMENSION_LABEL_PADDING * 2;
  const dimensionLabelHeight = DIMENSION_FONT_SIZE + DIMENSION_LABEL_PADDING * 2;

  return (
    <Group x={centerX} y={centerY} listening={false}>
      <Rect
        x={-dimensionLabelWidth / 2}
        y={-dimensionLabelHeight / 2}
        width={dimensionLabelWidth}
        height={dimensionLabelHeight}
        fill={DIMENSION_BG_FILL}
        cornerRadius={4}
        listening={false}
      />
      <Text
        text={labelText}
        x={-dimensionTextWidth / 2}
        y={-dimensionLabelHeight / 2}
        width={dimensionTextWidth}
        height={dimensionLabelHeight}
        fontSize={DIMENSION_FONT_SIZE}
        fontFamily="sans-serif"
        fill={DIMENSION_FILL}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
}
