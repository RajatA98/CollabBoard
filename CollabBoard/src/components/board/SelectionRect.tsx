import { Rect } from 'react-konva';

interface SelectionRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  /** Optional rotation in degrees (e.g. for per-object highlight). */
  rotation?: number;
}

export function SelectionRect({ x, y, width, height, visible, rotation = 0 }: SelectionRectProps) {
  if (!visible) return null;
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      rotation={rotation}
      fill="rgba(66, 133, 244, 0.1)"
      stroke="#4285f4"
      strokeWidth={1}
      dash={[4, 4]}
      listening={false}
    />
  );
}
