import { useRef, useEffect, useState } from 'react';
import { Rect, Group, Text } from 'react-konva';
import type { BoardObject, LiveTransformData } from '../../types';
import type { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';

interface FrameProps {
  object: BoardObject;
  isSelected: boolean;
  onSelect: (additive: boolean) => void;
  onUpdate: (updates: Partial<BoardObject>) => void;
  onDoubleClick?: () => void;
  onRightClick?: (screenX: number, screenY: number) => void;
  onDragStart?: () => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEndExtra?: () => void;
  remoteTransform?: LiveTransformData;
}

const FRAME_BORDER_COLOR = '#3366ff';
const FRAME_BORDER_COLOR_SELECTED = '#5588ff';
const FRAME_BG_COLOR = 'rgba(51, 102, 255, 0.05)';
const TITLE_BG_COLOR = '#3366ff';
const TITLE_HEIGHT = 22;
const TITLE_PADDING = 8;
const TITLE_FONT_SIZE = 13;

export function Frame({ object, isSelected, onSelect, onUpdate, onDoubleClick, onRightClick, onDragStart, onDragMove, onDragEndExtra, remoteTransform }: FrameProps) {
  const titleTextRef = useRef<Konva.Text>(null);
  const [titleWidth, setTitleWidth] = useState(80);

  useEffect(() => {
    if (titleTextRef.current) {
      setTitleWidth(titleTextRef.current.getTextWidth() + TITLE_PADDING * 2);
    }
  }, [object.text]);

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

  const title = object.text || 'Frame';
  const borderColor = isSelected ? FRAME_BORDER_COLOR_SELECTED : FRAME_BORDER_COLOR;

  return (
    <Group
      id={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation || 0}
      draggable
      onClick={handleClick}
      onTap={() => onSelect(false)}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
        onDragEndExtra?.();
      }}
    >
      {/* Frame background - subtle fill */}
      <Rect
        width={object.width}
        height={object.height}
        fill={FRAME_BG_COLOR}
        cornerRadius={0}
      />
      {/* Frame border */}
      <Rect
        width={object.width}
        height={object.height}
        stroke={borderColor}
        strokeWidth={2}
        cornerRadius={0}
      />
      {/* Title background - positioned above frame top edge */}
      <Rect
        x={0}
        y={-TITLE_HEIGHT}
        width={Math.min(titleWidth, object.width)}
        height={TITLE_HEIGHT}
        fill={TITLE_BG_COLOR}
        cornerRadius={[4, 4, 0, 0]}
      />
      {/* Title text */}
      <Text
        ref={titleTextRef}
        text={title}
        x={TITLE_PADDING}
        y={-TITLE_HEIGHT + 4}
        fontSize={TITLE_FONT_SIZE}
        fontFamily="system-ui, sans-serif"
        fontStyle="bold"
        fill="#ffffff"
        listening={false}
      />
      {/* Remote transform overlay */}
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
