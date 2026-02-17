import type { MutableRefObject } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { BoardObject } from '../../types';

interface LiveTransformSnapshot {
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
}

interface DimensionLabelProps {
  object: BoardObject;
  transformMode: 'idle' | 'resize' | 'rotate';
  liveTransform?: LiveTransformSnapshot | null;
  /** Ref updated synchronously in onTransform; use when set for same-frame label updates */
  liveTransformRef?: MutableRefObject<LiveTransformSnapshot | null>;
  /** Tick changes each frame during transform to force re-renders that read liveTransformRef */
  dimensionLabelTick?: number;
}

const DIMENSION_FONT_SIZE = 12;
const DIMENSION_FILL = '#333';
const DIMENSION_LABEL_PADDING = 6;
const DIMENSION_BG_FILL = 'rgba(255, 255, 255, 0.9)';

export function DimensionLabel({ object, transformMode, liveTransform, liveTransformRef, dimensionLabelTick }: DimensionLabelProps) {
  // Prefer ref (same-frame) during transform to avoid label delay; fallback to state then object
  const live = liveTransformRef?.current ?? liveTransform;
  void dimensionLabelTick; // used by parent to force re-renders so we re-read ref
  const width = live?.width ?? object.width;
  const height = live?.height ?? object.height;
  const rotation = live?.rotation ?? (object.rotation || 0);
  const x = live?.x ?? object.x;
  const y = live?.y ?? object.y;

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
