import { Circle } from 'react-konva';
import { getConnectionPoints } from '../../utils/connectionPoints';
import type { BoardObject } from '../../types';

interface ConnectionPointsProps {
  object: BoardObject;
  /** The point id of the source anchor if this shape is the pending-connection source */
  pendingSourcePointId: string | null;
  /** True when any connection is pending (affects colours) */
  hasPendingConnection: boolean;
  /** True while dragging a line endpoint — disables pointer events so the dots don't steal drag */
  ignorePointer?: boolean;
  /** Called on double-click to start a connection from this dot */
  onConnectStart: (shapeId: string, pointId: string) => void;
  /** Called on single-click when a pending connection exists — completes the connection */
  onConnectEnd: (shapeId: string, pointId: string) => void;
}

export function ConnectionPoints({
  object,
  pendingSourcePointId,
  hasPendingConnection,
  ignorePointer = false,
  onConnectStart,
  onConnectEnd,
}: ConnectionPointsProps) {
  const points = getConnectionPoints(object);

  return (
    <>
      {points.map((pt) => {
        const isSource = pendingSourcePointId === pt.id;
        const isTarget = hasPendingConnection && !isSource;

        return (
          <Circle
            key={`${object.id}-${pt.id}`}
            x={pt.x}
            y={pt.y}
            radius={isSource ? 7 : 5}
            fill={isSource ? '#ff6b00' : isTarget ? '#4285f4' : 'white'}
            stroke={isSource ? '#ff6b00' : '#4285f4'}
            strokeWidth={2}
            listening={!ignorePointer}
            onDblClick={() => onConnectStart(object.id, pt.id)}
            onDblTap={() => onConnectStart(object.id, pt.id)}
            onClick={() => {
              if (hasPendingConnection && !isSource) {
                onConnectEnd(object.id, pt.id);
              }
            }}
            onTap={() => {
              if (hasPendingConnection && !isSource) {
                onConnectEnd(object.id, pt.id);
              }
            }}
          />
        );
      })}
    </>
  );
}
