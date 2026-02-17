import { Group, Circle, Text } from 'react-konva';
import type { CursorData } from '../../types';

interface RemoteCursorProps {
  cursor: CursorData;
}

export function RemoteCursor({ cursor }: RemoteCursorProps) {
  return (
    <Group x={cursor.x} y={cursor.y}>
      <Circle radius={5} fill={cursor.color} />
      <Text
        text={cursor.name}
        x={10}
        y={-5}
        fontSize={12}
        fill={cursor.color}
        fontFamily="sans-serif"
      />
    </Group>
  );
}
