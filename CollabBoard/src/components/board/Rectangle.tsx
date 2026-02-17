import { Rect } from 'react-konva';
import type { BoardObject } from '../../types';
import type { KonvaEventObject } from 'konva/lib/Node';

interface RectangleProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: (additive: boolean) => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
  onDoubleClick?: () => void;
  onRightClick?: (screenX: number, screenY: number) => void;
  onDragStart?: () => void;
  onDragMove?: (x: number, y: number) => void;
}

export function Rectangle({ object, isSelected, onSelect, onUpdate, onDoubleClick, onRightClick, onDragStart, onDragMove }: RectangleProps) {
  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt && e.evt.button === 2) {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer) onRightClick?.(pointer.x, pointer.y);
    } else {
      onSelect(e.evt?.shiftKey ?? false);
    }
  };

  const handleContextMenu = (e: KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (pointer) onRightClick?.(pointer.x, pointer.y);
  };

  return (
    <Rect
      id={object.id}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation || 0}
      offsetX={0}
      offsetY={0}
      fill={object.color}
      stroke={isSelected ? '#0066ff' : '#ccc'}
      strokeWidth={isSelected ? 2 : 1}
      draggable
      onClick={handleClick}
      onTap={() => onSelect(false)}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={() => onDragStart?.()}
      onDragMove={(e) => onDragMove?.(e.target.x(), e.target.y())}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
      }}
    />
  );
}
