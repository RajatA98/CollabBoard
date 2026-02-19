import { Line, Rect, Group } from 'react-konva';
import { getConnectionPoints } from '../../utils/connectionPoints';
import type { BoardObject } from '../../types';

const X_HALF = 6;

interface ConnectionPointsProps {
  object: BoardObject;
  /** The point id of the source anchor when a connection drag is active from this shape */
  activeSourcePointId: string | null;
  /** True when a connection drag is in progress (affects styling of target Xs) */
  hasActiveConnection: boolean;
  /** True while dragging a line endpoint -- disables pointer events so Xs don't steal drag */
  ignorePointer?: boolean;
  /** Called on mousedown to start dragging a connection from this X */
  onConnectionDragStart: (shapeId: string, pointId: string, x: number, y: number) => void;
  /** Called on mouseup over a target X to complete a connection */
  onConnectionDragEnd: (shapeId: string, pointId: string) => void;
  /** Called on double-click to detach any line connected to this point */
  onDetachConnection?: (shapeId: string, pointId: string) => void;
}

export function ConnectionPoints({
  object,
  activeSourcePointId,
  hasActiveConnection,
  ignorePointer = false,
  onConnectionDragStart,
  onConnectionDragEnd,
  onDetachConnection,
}: ConnectionPointsProps) {
  const points = getConnectionPoints(object);

  return (
    <>
      {points.map((pt) => {
        const isSource = activeSourcePointId === pt.id;
        const isTarget = hasActiveConnection && !isSource;
        const strokeColor = isSource ? '#ff6b00' : '#4285f4';
        const scale = isSource ? 1.3 : 1;

        return (
          <Group key={`${object.id}-${pt.id}`} x={pt.x} y={pt.y} scaleX={scale} scaleY={scale}>
            {/* Invisible hit rect for easy targeting */}
            <Rect
              x={-X_HALF - 4}
              y={-X_HALF - 4}
              width={(X_HALF + 4) * 2}
              height={(X_HALF + 4) * 2}
              fill="transparent"
              listening={!ignorePointer}
              onMouseDown={(e) => {
                e.cancelBubble = true;
                onConnectionDragStart(object.id, pt.id, pt.x, pt.y);
              }}
              onTouchStart={(e) => {
                e.cancelBubble = true;
                onConnectionDragStart(object.id, pt.id, pt.x, pt.y);
              }}
              onMouseUp={() => {
                if (isTarget) onConnectionDragEnd(object.id, pt.id);
              }}
              onTouchEnd={() => {
                if (isTarget) onConnectionDragEnd(object.id, pt.id);
              }}
              onDblClick={() => {
                onDetachConnection?.(object.id, pt.id);
              }}
              onDblTap={() => {
                onDetachConnection?.(object.id, pt.id);
              }}
            />
            {/* X mark: two crossing lines */}
            <Line
              points={[-X_HALF, -X_HALF, X_HALF, X_HALF]}
              stroke={strokeColor}
              strokeWidth={2.5}
              lineCap="round"
              listening={false}
            />
            <Line
              points={[X_HALF, -X_HALF, -X_HALF, X_HALF]}
              stroke={strokeColor}
              strokeWidth={2.5}
              lineCap="round"
              listening={false}
            />
          </Group>
        );
      })}
    </>
  );
}
