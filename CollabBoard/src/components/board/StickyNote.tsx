import { useEffect } from 'react';
import { Rect, Text, Group } from 'react-konva';
import type { BoardObject, LiveTransformData, LiveEditingData } from '../../types';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  measureTextHeight,
  STICKY_TEXT_OFFSET_Y,
  STICKY_TEXT_PADDING_BOTTOM,
  STICKY_MIN_HEIGHT,
  STICKY_FONT_SIZE,
  STICKY_FONT_FAMILY,
} from '../../utils/textMeasure';

interface StickyNoteProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: (additive: boolean) => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
  onDoubleClick?: () => void;
  onRightClick?: (screenX: number, screenY: number) => void;
  onDragStart?: () => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEndExtra?: () => void;
  remoteEditing?: LiveEditingData;
  remoteTransform?: LiveTransformData;
}

export function StickyNote({ object, isSelected, onSelect, onUpdate, onDoubleClick, onRightClick, onDragStart, onDragMove, onDragEndExtra, remoteEditing, remoteTransform }: StickyNoteProps) {
  const handleDoubleClick = () => {
    console.log('Sticky note double-clicked!', object.id);
    if (onDoubleClick) {
      onDoubleClick();
    } else {
      console.error('onDoubleClick handler not provided');
    }
  };

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

  // Auto-expand height when text needs more space; never shrink below current size
  useEffect(() => {
    const displayText = remoteEditing ? remoteEditing.text : (object.text ?? '');
    if (!displayText) return;
    const textWidth = object.width - 16; // matches Text node width={object.width - 16}
    const neededTextHeight = measureTextHeight({
      text: displayText,
      width: textWidth,
      fontSize: STICKY_FONT_SIZE,
      fontFamily: STICKY_FONT_FAMILY,
    });

    const requiredHeight = Math.max(
      STICKY_MIN_HEIGHT,
      STICKY_TEXT_OFFSET_Y + neededTextHeight + STICKY_TEXT_PADDING_BOTTOM
    );
    // Only expand when text needs more space; never shrink
    if (requiredHeight > object.height && Math.abs(requiredHeight - object.height) > 1) {
      onUpdate({ height: requiredHeight });
    }
  }, [object.text, object.width, object.height, remoteEditing, onUpdate]);

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
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
        onDragEndExtra?.();
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
        text={remoteEditing ? remoteEditing.text : (object.text ?? 'Click to edit')}
        width={object.width - 16}
        x={8}
        y={26}
        fontSize={16}
        fontFamily="'Segoe Print', 'Comic Sans MS', cursive"
        fill={remoteEditing ? '#333' : (object.text ? '#333' : '#999')}
        fontStyle={remoteEditing ? 'normal' : (object.text ? 'normal' : 'italic')}
        opacity={remoteEditing ? 0.7 : 1}
        align="left"
        verticalAlign="top"
        wrap="word"
      />
      {/* Remote user's live editing indicator */}
      {remoteEditing && (
        <>
          <Rect
            x={0}
            y={0}
            width={object.width}
            height={object.height}
            stroke={remoteEditing.userColor}
            strokeWidth={3}
            cornerRadius={2}
            dash={[8, 4]}
            listening={false}
          />
          <Rect
            x={object.width - 90}
            y={-20}
            width={90}
            height={18}
            fill={remoteEditing.userColor}
            cornerRadius={4}
            listening={false}
          />
          <Text
            text={`${remoteEditing.userName} typing...`}
            x={object.width - 88}
            y={-18}
            width={86}
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
      {/* Remote transform indicator: colored border when another user is moving/resizing */}
      {remoteTransform && !remoteEditing && (
        <>
          <Rect
            x={-2}
            y={-2}
            width={object.width + 4}
            height={object.height + 4}
            stroke={remoteTransform.userColor}
            strokeWidth={2}
            cornerRadius={2}
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
