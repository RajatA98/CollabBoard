import { Line } from 'react-konva';
import { useMemo } from 'react';

interface GridBackgroundProps {
  viewport: { x: number; y: number; scaleX: number; scaleY: number };
  stageSize: { width: number; height: number };
}

const GRID_SPACING = 40;
const GRID_STROKE = '#e0e0e0';
const GRID_STROKE_WIDTH = 1;

export function GridBackground({ viewport, stageSize }: GridBackgroundProps) {
  const lines = useMemo(() => {
    const { x, y, scaleX, scaleY } = viewport;
    const startX = Math.floor(-x / scaleX / GRID_SPACING) * GRID_SPACING;
    const endX = startX + stageSize.width / scaleX + GRID_SPACING;
    const startY = Math.floor(-y / scaleY / GRID_SPACING) * GRID_SPACING;
    const endY = Math.ceil((stageSize.height - y) / scaleY / GRID_SPACING) * GRID_SPACING + GRID_SPACING;

    const result: Array<{ key: string; points: number[] }> = [];

    for (let gx = startX; gx <= endX; gx += GRID_SPACING) {
      result.push({ key: `v-${gx}`, points: [gx, startY, gx, endY] });
    }
    for (let gy = startY; gy <= endY; gy += GRID_SPACING) {
      result.push({ key: `h-${gy}`, points: [startX, gy, endX, gy] });
    }

    return result;
  }, [viewport, stageSize]);

  return (
    <>
      {lines.map((line) => (
        <Line
          key={line.key}
          points={line.points}
          stroke={GRID_STROKE}
          strokeWidth={GRID_STROKE_WIDTH}
          listening={false}
        />
      ))}
    </>
  );
}
