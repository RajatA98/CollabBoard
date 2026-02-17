import { Rect, Text, Group } from 'react-konva';
import type { BoardObject } from '../../types';

interface StickyNoteProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
  onDoubleClick?: () => void;
}

export function StickyNote({ object, isSelected, onSelect, onUpdate, onDoubleClick }: StickyNoteProps) {
  const handleDoubleClick = () => {
    console.log('🖱️ Sticky note double-clicked!', object.id);
    if (onDoubleClick) {
      onDoubleClick();
    } else {
      console.error('❌ onDoubleClick handler not provided');
    }
  };

  return (
    <Group
      x={object.x}
      y={object.y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
      }}
    >
      {/* Post-it note background with realistic styling */}
      <Rect
        width={object.width}
        height={object.height}
        fill={object.color || '#FFD54F'}
        stroke={isSelected ? '#FFA726' : '#FFE082'}
        strokeWidth={isSelected ? 3 : 1}
        cornerRadius={2}
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={8}
        shadowOffsetX={2}
        shadowOffsetY={4}
        shadowOpacity={0.3}
      />
      {/* Bottom-right corner curl effect (paper rolling up) */}
      <Rect
        x={object.width - 30}
        y={object.height - 30}
        width={30}
        height={30}
        fill="rgba(0,0,0,0.08)"
        cornerRadius={2}
      />
      {/* Text content */}
      <Text
        text={object.text ?? 'Double-click to edit'}
        width={object.width - 16}
        height={object.height - 16}
        x={8}
        y={8}
        fontSize={16}
        fontFamily="'Segoe Print', 'Comic Sans MS', cursive"
        fill={object.text ? '#333' : '#999'}
        fontStyle={object.text ? 'normal' : 'italic'}
        align="left"
        verticalAlign="top"
        wrap="word"
      />
    </Group>
  );
}
