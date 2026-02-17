import { Rect, Text, Group } from 'react-konva';
import type { BoardObject } from '../../types';

interface StickyNoteProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
}

export function StickyNote({ object, isSelected, onSelect, onUpdate }: StickyNoteProps) {
  return (
    <Group
      x={object.x}
      y={object.y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
      }}
    >
      <Rect
        width={object.width}
        height={object.height}
        fill={object.color}
        stroke={isSelected ? '#0066ff' : undefined}
        strokeWidth={isSelected ? 2 : 0}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.1)"
        shadowBlur={4}
        shadowOffsetY={2}
      />
      <Text
        text={object.text ?? ''}
        width={object.width}
        height={object.height}
        padding={8}
        fontSize={14}
        fontFamily="sans-serif"
        fill="#333"
      />
    </Group>
  );
}
