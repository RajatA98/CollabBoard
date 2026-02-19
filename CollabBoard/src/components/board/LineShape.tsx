import { Line, Group, Rect, Text } from 'react-konva';
import type { BoardObject, LiveTransformData } from '../../types';
import type { KonvaEventObject } from 'konva/lib/Node';

interface LineShapeProps {
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

/** Build the flat list of {x,y} point objects for a line: start → waypoints → end (absolute coords) */
export function buildLinePointObjects(obj: BoardObject): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [{ x: obj.x, y: obj.y }];
  if (obj.waypoints) {
    for (const wp of obj.waypoints) {
      pts.push({ x: wp.x, y: wp.y });
    }
  }
  pts.push({ x: obj.x + obj.width, y: obj.y + obj.height });
  return pts;
}

/** Build flat number[] relative to the Group origin at (obj.x, obj.y) */
function buildRelativeFlatPoints(obj: BoardObject): number[] {
  const flat: number[] = [0, 0];
  if (obj.waypoints) {
    for (const wp of obj.waypoints) {
      flat.push(wp.x - obj.x, wp.y - obj.y);
    }
  }
  flat.push(obj.width, obj.height);
  return flat;
}

const ARROW_SIZE = 12;

function arrowHead(tipX: number, tipY: number, fromX: number, fromY: number): number[] {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const a1 = angle + Math.PI * 0.85;
  const a2 = angle - Math.PI * 0.85;
  return [
    tipX + ARROW_SIZE * Math.cos(a1), tipY + ARROW_SIZE * Math.sin(a1),
    tipX, tipY,
    tipX + ARROW_SIZE * Math.cos(a2), tipY + ARROW_SIZE * Math.sin(a2),
  ];
}

/** Build relative point objects for arrow head calculation */
function relativePoints(obj: BoardObject): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  if (obj.waypoints) {
    for (const wp of obj.waypoints) {
      pts.push({ x: wp.x - obj.x, y: wp.y - obj.y });
    }
  }
  pts.push({ x: obj.width, y: obj.height });
  return pts;
}

export function LineShape({ object, isSelected, onSelect, onUpdate, onDoubleClick, onRightClick, onDragStart, onDragMove, onDragEndExtra, remoteTransform }: LineShapeProps) {
  const isConnected = !!(object.fromId || object.toId);

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

  const points = buildRelativeFlatPoints(object);
  const ptRel = relativePoints(object);
  const arrowType = object.arrowType ?? 'none';
  const sw = object.strokeWidth ?? 2;
  const dash = object.lineStyle === 'dashed' ? [8, 6] : object.lineStyle === 'dotted' ? [2, 4] : undefined;

  const endArrow = (arrowType === 'single' || arrowType === 'double') && ptRel.length >= 2
    ? arrowHead(ptRel[ptRel.length - 1].x, ptRel[ptRel.length - 1].y, ptRel[ptRel.length - 2].x, ptRel[ptRel.length - 2].y)
    : null;
  const startArrow = arrowType === 'double' && ptRel.length >= 2
    ? arrowHead(ptRel[0].x, ptRel[0].y, ptRel[1].x, ptRel[1].y)
    : null;

  const labelRelX = Math.min(0, object.width) - 2;
  const labelRelY = Math.min(0, object.height) - 20;

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      draggable={!isConnected}
      onClick={handleClick}
      onTap={() => onSelect(false)}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        const node = e.target;
        const newX = node.x();
        const newY = node.y();
        const dx = newX - object.x;
        const dy = newY - object.y;
        onUpdate({
          x: newX,
          y: newY,
          waypoints: (object.waypoints ?? []).map(w => ({ x: w.x + dx, y: w.y + dy })),
        });
        onDragEndExtra?.();
      }}
    >
      <Line
        points={points}
        stroke="transparent"
        strokeWidth={16}
        hitStrokeWidth={16}
        listening
      />
      <Line
        points={points}
        stroke={object.color || '#424242'}
        strokeWidth={isSelected ? sw + 1 : sw}
        lineCap="round"
        lineJoin="round"
        dash={dash}
        listening={false}
      />
      {endArrow && (
        <Line
          points={endArrow}
          stroke={object.color || '#424242'}
          strokeWidth={sw}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {startArrow && (
        <Line
          points={startArrow}
          stroke={object.color || '#424242'}
          strokeWidth={sw}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {remoteTransform && (
        <>
          <Rect
            x={labelRelX}
            y={labelRelY}
            width={60}
            height={18}
            fill={remoteTransform.userColor}
            cornerRadius={4}
            listening={false}
          />
          <Text
            text={remoteTransform.userName}
            x={labelRelX + 2}
            y={labelRelY + 2}
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
