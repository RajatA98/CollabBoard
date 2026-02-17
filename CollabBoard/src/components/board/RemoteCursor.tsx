import { Group, Path, Rect, Text } from 'react-konva';
import type { CursorData } from '../../types';

interface RemoteCursorProps {
  cursor: CursorData;
  scale: number;
}

// Standard mouse cursor arrow path (tip at 0,0)
// M 0 0  → hotspot tip
// L 0 16 → straight down
// L 4 12 → inner notch
// L 7 19 → bottom of stem
// L 9.5 18 → right of stem
// L 6.5 11 → inner stem
// L 12 11 → far right
// Z      → close
const CURSOR_PATH = 'M 0 0 L 0 16 L 4 12 L 7 19 L 9.5 18 L 6.5 11 L 12 11 Z';

const FONT_SIZE = 12;
const FONT_FAMILY = 'Inter, system-ui, sans-serif';
const H_PADDING = 8;
const V_PADDING = 4;
const BADGE_HEIGHT = FONT_SIZE + V_PADDING * 2;
const CORNER_RADIUS = 4;
// Badge sits offset from cursor tip
const BADGE_X = 14;
const BADGE_Y = 14;

export function RemoteCursor({ cursor, scale }: RemoteCursorProps) {
  // Counter-scale so the cursor renders at a fixed screen size regardless of zoom
  const invScale = 1 / Math.max(scale, 0.01);

  // Estimate badge width based on name length
  const approxCharWidth = FONT_SIZE * 0.6;
  const badgeWidth = Math.max(cursor.name.length * approxCharWidth + H_PADDING * 2, 40);

  return (
    <Group x={cursor.x} y={cursor.y} scaleX={invScale} scaleY={invScale}>
      {/* Cursor arrow with white outline for contrast on any background */}
      <Path
        data={CURSOR_PATH}
        fill={cursor.color}
        stroke="white"
        strokeWidth={1.5}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={4}
        shadowOffsetX={1}
        shadowOffsetY={1}
      />

      {/* Name badge */}
      <Rect
        x={BADGE_X}
        y={BADGE_Y}
        width={badgeWidth}
        height={BADGE_HEIGHT}
        fill={cursor.color}
        cornerRadius={CORNER_RADIUS}
        shadowColor="rgba(0,0,0,0.25)"
        shadowBlur={4}
        shadowOffsetX={0}
        shadowOffsetY={2}
      />
      <Text
        text={cursor.name}
        x={BADGE_X + H_PADDING}
        y={BADGE_Y + V_PADDING}
        fontSize={FONT_SIZE}
        fontFamily={FONT_FAMILY}
        fontStyle="600"
        fill="white"
        listening={false}
      />
    </Group>
  );
}
