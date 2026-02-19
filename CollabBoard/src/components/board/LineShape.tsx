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

/** Build the flat list of {x,y} point objects for a line: start → waypoints → end */
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

/** Build the flat number[] array Konva needs (relative to the group position) */
function buildFlatPoints(obj: BoardObject): number[] {
  const pts = buildLinePointObjects(obj);
  // All coordinates are absolute; the Group is at (0,0) so we pass them as-is
  const flat: number[] = [];
  for (const pt of pts) {
    flat.push(pt.x, pt.y);
  }
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

export function LineShape({ object, isSelected, onSelect, onUpdate: _onUpdate, onDoubleClick, onRightClick, onDragStart: _onDragStart, onDragMove: _onDragMove, onDragEndExtra: _onDragEndExtra, remoteTransform }: LineShapeProps) {
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

  const points = buildFlatPoints(object);
  const ptObjs = buildLinePointObjects(object);
  const arrowType = object.arrowType ?? 'none';

  // Arrow heads
  const endArrow = (arrowType === 'single' || arrowType === 'double') && ptObjs.length >= 2
    ? arrowHead(ptObjs[ptObjs.length - 1].x, ptObjs[ptObjs.length - 1].y, ptObjs[ptObjs.length - 2].x, ptObjs[ptObjs.length - 2].y)
    : null;
  const startArrow = arrowType === 'double' && ptObjs.length >= 2
    ? arrowHead(ptObjs[0].x, ptObjs[0].y, ptObjs[1].x, ptObjs[1].y)
    : null;

  return (
    <Group
      id={object.id}
      onClick={handleClick}
      onTap={() => onSelect(false)}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Invisible wider hit area for easier clicking */}
      <Line
        points={points}
        stroke="transparent"
        strokeWidth={16}
        hitStrokeWidth={16}
        listening
      />
      {/* Visible line */}
      <Line
        points={points}
        stroke={object.color || '#424242'}
        strokeWidth={isSelected ? 3 : 2}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
      {/* Arrow heads */}
      {endArrow && (
        <Line
          points={endArrow}
          stroke={object.color || '#424242'}
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {startArrow && (
        <Line
          points={startArrow}
          stroke={object.color || '#424242'}
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {remoteTransform && (
        <>
          <Rect
            x={Math.min(object.x, object.x + object.width) - 2}
            y={Math.min(object.y, object.y + object.height) - 20}
            width={60}
            height={18}
            fill={remoteTransform.userColor}
            cornerRadius={4}
            listening={false}
          />
          <Text
            text={remoteTransform.userName}
            x={Math.min(object.x, object.x + object.width)}
            y={Math.min(object.y, object.y + object.height) - 18}
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
