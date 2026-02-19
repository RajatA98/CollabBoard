import { useEffect } from 'react';
import { Rect, Text, Group } from 'react-konva';
import type { BoardObject, LiveTransformData, LiveEditingData } from '../../types';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  measureTextHeight,
  TEXT_ELEMENT_PADDING,
  TEXT_ELEMENT_MIN_HEIGHT,
  TEXT_ELEMENT_FONT_SIZE,
  TEXT_ELEMENT_FONT_FAMILY,
} from '../../utils/textMeasure';

interface TextElementProps {
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

export function TextElement({
  object,
  isSelected,
  onSelect,
  onUpdate,
  onDoubleClick,
  onRightClick,
  onDragStart,
  onDragMove,
  onDragEndExtra,
  remoteEditing,
  remoteTransform,
}: TextElementProps) {
  // Auto-expand: measure text height and update object if needed
  useEffect(() => {
    const displayText = remoteEditing ? remoteEditing.text : (object.text ?? '');
    if (!displayText) return; // Don't auto-expand for empty/placeholder text
    const textWidth = object.width - TEXT_ELEMENT_PADDING * 2;
    const neededHeight = measureTextHeight({
      text: displayText,
      width: textWidth,
      fontSize: TEXT_ELEMENT_FONT_SIZE,
      fontFamily: TEXT_ELEMENT_FONT_FAMILY,
    }) + TEXT_ELEMENT_PADDING * 2;

    const requiredHeight = Math.max(TEXT_ELEMENT_MIN_HEIGHT, neededHeight);

    if (Math.abs(requiredHeight - object.height) > 1) {
      onUpdate({ height: requiredHeight });
    }
  }, [object.text, object.width, object.height, remoteEditing, onUpdate]);

  const handleDoubleClick = () => {
    onDoubleClick?.();
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

  const displayText = remoteEditing
    ? remoteEditing.text
    : (object.text || 'Type text');

  const hasContent = remoteEditing ? !!remoteEditing.text : !!object.text;

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
      onDragStart={onDragStart}
      onDblTap={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
        onDragEndExtra?.();
      }}
    >
      {/* Background: transparent, with dashed border when selected */}
      <Rect
        width={object.width}
        height={object.height}
        fill="transparent"
        stroke={isSelected ? '#4285f4' : 'transparent'}
        strokeWidth={isSelected ? 2 : 0}
        dash={isSelected ? [6, 4] : undefined}
      />
      {/* Text content */}
      <Text
        text={displayText}
        width={object.width - TEXT_ELEMENT_PADDING * 2}
        x={TEXT_ELEMENT_PADDING}
        y={TEXT_ELEMENT_PADDING}
        fontSize={TEXT_ELEMENT_FONT_SIZE}
        fontFamily={TEXT_ELEMENT_FONT_FAMILY}
        fill={hasContent ? '#333' : '#999'}
        fontStyle={hasContent ? 'normal' : 'italic'}
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
      {/* Remote transform indicator */}
      {remoteTransform && !remoteEditing && (
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
