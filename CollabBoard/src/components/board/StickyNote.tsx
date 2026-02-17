import { Rect, Text, Group } from 'react-konva';
import type { BoardObject } from '../../types';
import type { KonvaEventObject } from 'konva/lib/Node';

interface StickyNoteProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: (additive: boolean) => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
  onDoubleClick?: () => void;
  onRightClick?: (screenX: number, screenY: number) => void;
  onDragStart?: () => void;
  onDragMove?: (x: number, y: number) => void;
}

export function StickyNote({ object, isSelected, onSelect, onUpdate, onDoubleClick, onRightClick, onDragStart, onDragMove }: StickyNoteProps) {
  const handleDoubleClick = () => {
    console.log('🖱️ Sticky note double-clicked!', object.id);
    if (onDoubleClick) {
      onDoubleClick();
    } else {
      console.error('❌ onDoubleClick handler not provided');
    }
  };

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
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation || 0}
      draggable
      onClick={handleClick}
      onTap={() => onSelect(false)}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={() => onDragStart?.()}
      onDragMove={(e) => onDragMove?.(e.target.x(), e.target.y())}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
      }}
    >
      {/* Note background */}
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
      {/* "Note:" label at top left */}
      <Text
        text="Note:"
        x={8}
        y={6}
        fontSize={12}
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fill="#666"
        fontStyle="bold"
      />
      {/* Text content */}
      <Text
        text={object.text ?? 'Click to edit'}
        width={object.width - 16}
        height={object.height - 28}
        x={8}
        y={26}
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
