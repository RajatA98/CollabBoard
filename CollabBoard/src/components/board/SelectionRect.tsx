import { Rect } from 'react-konva';

interface SelectionRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export function SelectionRect({ x, y, width, height, visible }: SelectionRectProps) {
  if (!visible) return null;
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(66, 133, 244, 0.1)"
      stroke="#4285f4"
      strokeWidth={1}
      dash={[4, 4]}
      listening={false}
    />
  );
}
