import type { BoardObject } from '../types';

export type Direction = 'top' | 'right' | 'bottom' | 'left';

export interface ConnectionPoint {
  id: string;
  x: number;
  y: number;
  direction: Direction;
}

/**
 * Returns the four cardinal connection points for a shape (non-line).
 * Coordinates are in world space.
 */
export function getConnectionPoints(obj: BoardObject): ConnectionPoint[] {
  if (obj.type === 'line') return [];

  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;

  return [
    { id: 'top', x: cx, y: obj.y, direction: 'top' },
    { id: 'right', x: obj.x + obj.width, y: cy, direction: 'right' },
    { id: 'bottom', x: cx, y: obj.y + obj.height, direction: 'bottom' },
    { id: 'left', x: obj.x, y: cy, direction: 'left' },
  ];
}

/**
 * Look up a single connection point by its id (top/right/bottom/left).
 */
export function getConnectionPointById(
  obj: BoardObject,
  pointId: string,
): (ConnectionPoint & { direction: Direction }) | null {
  const pts = getConnectionPoints(obj);
  return pts.find((p) => p.id === pointId) ?? null;
}
