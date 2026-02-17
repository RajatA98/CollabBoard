import { Group, Circle, Text, Rect } from 'react-konva';
import type { CursorData } from '../../types';

interface RemoteCursorProps {
  cursor: CursorData;
  scale: number;
}

const FONT_SIZE = 12;
const FONT_FAMILY = 'Inter, system-ui, sans-serif';
const H_PADDING = 8;
const V_PADDING = 4;
const BADGE_HEIGHT = FONT_SIZE + V_PADDING * 2;
const CORNER_RADIUS = 4;
const CIRCLE_RADIUS = 6;
// Badge sits to the right and slightly below the circle
const BADGE_X = CIRCLE_RADIUS + 4;
const BADGE_Y = -(BADGE_HEIGHT / 2);

export function RemoteCursor({ cursor, scale }: RemoteCursorProps) {
  const invScale = 1 / Math.max(scale, 0.01);

  const approxCharWidth = FONT_SIZE * 0.6;
  const badgeWidth = Math.max(cursor.name.length * approxCharWidth + H_PADDING * 2, 40);

  return (
    <Group x={cursor.x} y={cursor.y} scaleX={invScale} scaleY={invScale}>
      <Circle
        radius={CIRCLE_RADIUS}
        fill={cursor.color}
        stroke="white"
        strokeWidth={2}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={4}
        shadowOffsetX={1}
        shadowOffsetY={1}
      />
      <Rect
        x={BADGE_X}
        y={BADGE_Y}
        width={badgeWidth}
        height={BADGE_HEIGHT}
        fill={cursor.color}
        cornerRadius={CORNER_RADIUS}
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
