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

  useEffect(() => {
    const displayText = remoteEditing ? remoteEditing.text : (object.text ?? '');
    if (!displayText) return;
    if (!Number.isFinite(object.width) || !Number.isFinite(object.height) || object.width <= 0 || object.height <= 0) return;
    const textWidth = object.width - TEXT_ELEMENT_PADDING * 2;
    if (!Number.isFinite(textWidth) || textWidth <= 0) return;
    const neededTextHeight = measureTextHeight({
      text: displayText,
      width: textWidth,
      fontSize: object.fontSize || TEXT_ELEMENT_FONT_SIZE,
      fontFamily: object.fontFamily || TEXT_ELEMENT_FONT_FAMILY,
    });
    if (!Number.isFinite(neededTextHeight)) return;
    const requiredHeight = Math.max(
      TEXT_ELEMENT_MIN_HEIGHT,
      TEXT_ELEMENT_PADDING + neededTextHeight + TEXT_ELEMENT_PADDING,
    );
    if (!Number.isFinite(requiredHeight)) return;
    if (requiredHeight > object.height && Math.abs(requiredHeight - object.height) > 1) {
      onUpdate({ height: requiredHeight });
    }
  }, [object.text, object.width, object.height, remoteEditing, onUpdate]);

  const x = Number.isFinite(object.x) ? object.x : 0;
  const y = Number.isFinite(object.y) ? object.y : 0;
  const w = Number.isFinite(object.width) && object.width > 0 ? object.width : 200;
  const h = Number.isFinite(object.height) && object.height > 0 ? object.height : 40;
  const rot = Number.isFinite(object.rotation) ? (object.rotation ?? 0) : 0;

  const hasContent = remoteEditing ? !!remoteEditing.text : !!object.text;
  const displayText = remoteEditing
    ? remoteEditing.text
    : (object.text || 'Type text');

  return (
    <Group
      id={object.id}
      x={x}
      y={y}
      width={w}
      height={h}
      rotation={rot}
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
      {/* Clear background — visible border only when selected */}
      <Rect
        width={w}
        height={h}
        fill="transparent"
        stroke={isSelected ? '#4285f4' : 'transparent'}
        strokeWidth={isSelected ? 2 : 0}
        dash={isSelected ? [6, 4] : undefined}
        cornerRadius={2}
      />
      {/* Text content */}
      <Text
        text={displayText}
        width={w - TEXT_ELEMENT_PADDING * 2}
        x={TEXT_ELEMENT_PADDING}
        y={TEXT_ELEMENT_PADDING}
        fontSize={object.fontSize || TEXT_ELEMENT_FONT_SIZE}
        fontFamily={object.fontFamily || TEXT_ELEMENT_FONT_FAMILY}
        fill={object.textColor ?? (hasContent ? '#333' : '#999')}
        fontStyle={
          hasContent
            ? [object.bold && 'bold', object.italic && 'italic'].filter(Boolean).join(' ') || 'normal'
            : 'italic'
        }
        textDecoration={object.underline ? 'underline' : ''}
        opacity={remoteEditing ? 0.7 : 1}
        align="left"
        verticalAlign="top"
        wrap="word"
      />
      {/* Remote editing indicator */}
      {remoteEditing && (
        <>
          <Rect
            x={0}
            y={0}
            width={w}
            height={h}
            stroke={remoteEditing.userColor}
            strokeWidth={3}
            dash={[8, 4]}
            cornerRadius={2}
            listening={false}
          />
          <Rect
            x={w - 90}
            y={-20}
            width={90}
            height={18}
            fill={remoteEditing.userColor}
            cornerRadius={4}
            listening={false}
          />
          <Text
            text={`${remoteEditing.userName} typing...`}
            x={w - 88}
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
            width={w + 4}
            height={h + 4}
            stroke={remoteTransform.userColor}
            strokeWidth={2}
            dash={[6, 3]}
            cornerRadius={2}
            listening={false}
          />
          <Rect
            x={w - 60}
            y={-20}
            width={60}
            height={18}
            fill={remoteTransform.userColor}
            cornerRadius={4}
            listening={false}
          />
          <Text
            text={remoteTransform.userName}
            x={w - 58}
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
