import { Line, Group, Rect, Text } from 'react-konva';
import type { BoardObject, LiveTransformData } from '../../types';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useMemo } from 'react';

const EMPTY_POINTS: number[] = [];

interface PenStrokeProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: (additive: boolean) => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
  onDoubleClick?: () => void;
  onRightClick?: (screenX: number, screenY: number) => void;
  onDragStart?: () => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEndExtra?: () => void;
  remoteTransform?: LiveTransformData;
}

export function PenStroke({ object, isSelected, onSelect, onUpdate, onRightClick, onDragStart, onDragMove, onDragEndExtra, remoteTransform }: PenStrokeProps) {
  const points = object.points ?? EMPTY_POINTS;

  const bounds = useMemo(() => {
    if (points.length < 4) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      const px = points[i];
      const py = points[i + 1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    return { minX, minY, maxX, maxY };
  }, [points]);

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt && e.evt.button === 2) {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer) onRightClick?.(pointer.x, pointer.y);
    } else {
      onSelect(!!(e.evt?.ctrlKey || e.evt?.metaKey));
    }
  };

  const handleContextMenu = (e: KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    onRightClick?.(e.evt.clientX, e.evt.clientY);
  };

  const sw = object.strokeWidth ?? 2;
  const pad = sw / 2 + 4;

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation || 0}
      draggable
      onClick={handleClick}
      onTap={() => onSelect(false)}
      onContextMenu={handleContextMenu}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
        onDragEndExtra?.();
      }}
    >
      <Line
        points={points}
        stroke={object.color}
        strokeWidth={sw}
        lineCap="round"
        lineJoin="round"
        tension={0}
        hitStrokeWidth={Math.max(20, sw + 10)}
      />
      {isSelected && points.length >= 4 && (
        <Rect
          x={bounds.minX - pad}
          y={bounds.minY - pad}
          width={bounds.maxX - bounds.minX + pad * 2}
          height={bounds.maxY - bounds.minY + pad * 2}
          stroke="#0066ff"
          strokeWidth={1.5}
          dash={[6, 3]}
          listening={false}
        />
      )}
      {remoteTransform && (
        <>
          <Rect
            x={bounds.minX - pad - 2}
            y={bounds.minY - pad - 2}
            width={bounds.maxX - bounds.minX + pad * 2 + 4}
            height={bounds.maxY - bounds.minY + pad * 2 + 4}
            stroke={remoteTransform.userColor}
            strokeWidth={2}
            dash={[6, 3]}
            listening={false}
          />
          <Rect
            x={bounds.maxX + pad - 58}
            y={bounds.minY - pad - 22}
            width={60}
            height={18}
            fill={remoteTransform.userColor}
            cornerRadius={4}
            listening={false}
          />
          <Text
            text={remoteTransform.userName}
            x={bounds.maxX + pad - 56}
            y={bounds.minY - pad - 20}
            width={56}
            height={14}
            fontSize={10}
            fontFamily="sans-serif"
            fill="#FFFFFF"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}
