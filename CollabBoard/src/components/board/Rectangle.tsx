import { Rect } from 'react-konva';
import type { BoardObject } from '../../types';

interface RectangleProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
}

export function Rectangle({ object, isSelected, onSelect, onUpdate }: RectangleProps) {
  return (
    <Rect
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      fill={object.color}
      stroke={isSelected ? '#0066ff' : '#ccc'}
      strokeWidth={isSelected ? 2 : 1}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
      }}
    />
  );
}
