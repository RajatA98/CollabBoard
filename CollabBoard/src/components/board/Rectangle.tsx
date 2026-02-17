import { Rect, Group, Text } from 'react-konva';
import type { BoardObject, LiveTransformData } from '../../types';
import type { KonvaEventObject } from 'konva/lib/Node';

interface RectangleProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
  onDoubleClick?: () => void;
  onRightClick?: (screenX: number, screenY: number) => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEndExtra?: () => void;
  remoteTransform?: LiveTransformData;
}

export function Rectangle({ object, isSelected, onSelect, onUpdate, onDoubleClick, onRightClick, onDragMove, onDragEndExtra, remoteTransform }: RectangleProps) {
  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt && e.evt.button === 2) {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer) onRightClick?.(pointer.x, pointer.y);
    } else {
      onSelect();
    }
  };

  const handleContextMenu = (e: KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (pointer) onRightClick?.(pointer.x, pointer.y);
  };

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation || 0}
      draggable
      onClick={handleClick}
      onTap={onSelect}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onContextMenu={handleContextMenu}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
        onDragEndExtra?.();
      }}
    >
      <Rect
        width={object.width}
        height={object.height}
        offsetX={0}
        offsetY={0}
        fill={object.color}
        stroke={isSelected ? '#0066ff' : '#ccc'}
        strokeWidth={isSelected ? 2 : 1}
      />
      {remoteTransform && (
        <>
          <Rect
            x={-2}
            y={-2}
            width={object.width + 4}
            height={object.height + 4}
            stroke={remoteTransform.userColor}
            strokeWidth={2}
            dash={[6, 3]}
            listening={false}
          />
          <Rect
            x={object.width - 60}
            y={-20}
            width={60}
            height={18}
            fill={remoteTransform.userColor}
            cornerRadius={4}
            listening={false}
          />
          <Text
            text={remoteTransform.userName}
            x={object.width - 58}
            y={-18}
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
