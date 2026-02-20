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

  // Auto-expand height when text needs more space; never shrink below current size
  useEffect(() => {
    const displayText = remoteEditing ? remoteEditing.text : (object.text ?? '');
    if (!displayText) return;
    // Guard: avoid NaN from bad transform (e.g. after rotation) — never persist non-finite values
    if (!Number.isFinite(object.width) || !Number.isFinite(object.height) || object.width <= 0 || object.height <= 0) return;
    const textWidth = object.width - 16; // matches Text node width
    if (!Number.isFinite(textWidth) || textWidth <= 0) return;
    const neededTextHeight = measureTextHeight({
      text: displayText,
      width: textWidth,
      fontSize: object.fontSize || STICKY_FONT_SIZE,
      fontFamily: object.fontFamily || STICKY_FONT_FAMILY,
    });
    if (!Number.isFinite(neededTextHeight)) return;
    const requiredHeight = Math.max(
      STICKY_MIN_HEIGHT,
      STICKY_TEXT_OFFSET_Y + neededTextHeight + STICKY_TEXT_PADDING_BOTTOM
    );
    if (!Number.isFinite(requiredHeight)) return;
    // Only expand when text needs more space; never shrink
    if (requiredHeight > object.height && Math.abs(requiredHeight - object.height) > 1) {
      onUpdate({ height: requiredHeight });
    }
  }, [object.text, object.width, object.height, remoteEditing, onUpdate]);

  // Guard against NaN/Infinity (e.g. after rotating inside frame) so Konva never receives invalid numbers
  const x = Number.isFinite(object.x) ? object.x : 0;
  const y = Number.isFinite(object.y) ? object.y : 0;
  const w = Number.isFinite(object.width) && object.width > 0 ? object.width : 100;
  const h = Number.isFinite(object.height) && object.height > 0 ? object.height : 100;
  const rot = Number.isFinite(object.rotation) ? (object.rotation ?? 0) : 0;

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
      {/* Note background */}
      <Rect
        width={w}
        height={h}
        fill={object.color || '#FFD700'}
        stroke={object.strokeWidth === 0 ? 'transparent' : (isSelected ? '#FFA726' : '#FFE082')}
        strokeWidth={object.strokeWidth === 0 ? 0 : (isSelected ? 3 : 1)}
        cornerRadius={2}
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={8}
        shadowOffsetX={2}
        shadowOffsetY={4}
        shadowOpacity={0.3}
      />
      {/* Text content */}
      <Text
        text={remoteEditing ? remoteEditing.text : (object.text || 'Type your note...')}
        width={w - 16}
        x={8}
        y={8}
        fontSize={object.fontSize || STICKY_FONT_SIZE}
        fontFamily={object.fontFamily || STICKY_FONT_FAMILY}
        fill={object.textColor ?? (remoteEditing ? '#333' : (object.text ? '#333' : '#999'))}
        fontStyle={
          remoteEditing
            ? 'normal'
            : object.text
              ? [object.bold && 'bold', object.italic && 'italic'].filter(Boolean).join(' ') || 'normal'
              : 'italic'
        }
        textDecoration={object.underline ? 'underline' : ''}
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
            width={w}
            height={h}
            stroke={remoteEditing.userColor}
            strokeWidth={3}
            cornerRadius={2}
            dash={[8, 4]}
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
      {/* Remote transform indicator: colored border when another user is moving/resizing */}
      {remoteTransform && !remoteEditing && (
        <>
          <Rect
            x={-2}
            y={-2}
            width={w + 4}
            height={h + 4}
            stroke={remoteTransform.userColor}
            strokeWidth={2}
            cornerRadius={2}
            dash={[6, 3]}
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
