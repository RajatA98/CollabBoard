import { Group, Circle, Text, Rect } from 'react-konva';
import type { CursorData } from '../../types';

interface RemoteCursorProps {
  cursor: CursorData;
}

// Cursor styling constants
const CURSOR_DOT_RADIUS = 8;
const CURSOR_SHADOW_BLUR = 4;
const LABEL_PADDING_X = 8;
const LABEL_PADDING_Y = 4;
const LABEL_OFFSET_X = 12;
const LABEL_OFFSET_Y = -8;
const LABEL_FONT_SIZE = 12;
const LABEL_BG_OPACITY = 0.9;
const LABEL_BG_CORNER_RADIUS = 4;

export function RemoteCursor({ cursor }: RemoteCursorProps) {
  // Calculate label dimensions for background
  // Approximate text width: name.length * fontSize * 0.6 (rough estimation for sans-serif)
  const textWidth = cursor.name.length * LABEL_FONT_SIZE * 0.6;
  const labelWidth = textWidth + LABEL_PADDING_X * 2;
  const labelHeight = LABEL_FONT_SIZE + LABEL_PADDING_Y * 2;

  return (
    <Group x={cursor.x} y={cursor.y} listening={false}>
      {/* Cursor dot with shadow */}
      <Circle 
        radius={CURSOR_DOT_RADIUS} 
        fill={cursor.color}
        shadowColor="rgba(0, 0, 0, 0.3)"
        shadowBlur={CURSOR_SHADOW_BLUR}
        shadowOffset={{ x: 0, y: 1 }}
      />
      
      {/* Name label background */}
      <Rect
        x={LABEL_OFFSET_X}
        y={LABEL_OFFSET_Y}
        width={labelWidth}
        height={labelHeight}
        fill={cursor.color}
        opacity={LABEL_BG_OPACITY}
        cornerRadius={LABEL_BG_CORNER_RADIUS}
      />
      
      {/* Name label text */}
      <Text
        text={cursor.name}
        x={LABEL_OFFSET_X + LABEL_PADDING_X}
        y={LABEL_OFFSET_Y + LABEL_PADDING_Y}
        fontSize={LABEL_FONT_SIZE}
        fill="#FFFFFF"
        fontFamily="sans-serif"
        fontStyle="bold"
      />
    </Group>
  );
}
