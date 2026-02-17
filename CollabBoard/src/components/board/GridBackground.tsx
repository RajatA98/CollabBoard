import { Circle } from 'react-konva';
import { useMemo } from 'react';

interface GridBackgroundProps {
  viewport: { x: number; y: number; scaleX: number; scaleY: number };
  stageSize: { width: number; height: number };
}

const GRID_SPACING = 40;
const DOT_RADIUS = 1.5;
const DOT_COLOR = '#ddd';

export function GridBackground({ viewport, stageSize }: GridBackgroundProps) {
  const dots = useMemo(() => {
    const { x, y, scaleX, scaleY } = viewport;
    const startX = Math.floor(-x / scaleX / GRID_SPACING) * GRID_SPACING;
    const startY = Math.floor(-y / scaleY / GRID_SPACING) * GRID_SPACING;
    const endX = startX + stageSize.width / scaleX + GRID_SPACING;
    const endY = startY + stageSize.height / scaleY + GRID_SPACING;

    const result: Array<{ x: number; y: number; key: string }> = [];
    for (let gx = startX; gx < endX; gx += GRID_SPACING) {
      for (let gy = startY; gy < endY; gy += GRID_SPACING) {
        result.push({ x: gx, y: gy, key: `${gx}-${gy}` });
      }
    }
    return result;
  }, [viewport, stageSize]);

  return (
    <>
      {dots.map((dot) => (
        <Circle
          key={dot.key}
          x={dot.x}
          y={dot.y}
          radius={DOT_RADIUS}
          fill={DOT_COLOR}
          listening={false}
        />
      ))}
    </>
  );
}
