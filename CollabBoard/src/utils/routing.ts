import type { Direction } from './connectionPoints';
import type { BoardObject, Waypoint } from '../types';

const MARGIN = 20;

/**
 * Simple orthogonal router: produces a list of waypoints that form a
 * right-angled path from `start` to `end`, respecting the departure
 * directions of each endpoint.
 *
 * The algorithm is intentionally simple — it produces at most two bends
 * (an S or Z shape). It does NOT perform obstacle avoidance but accepts
 * an `objects` array and `excludeIds` for future expansion.
 */
export function routeOrthogonal(
  start: { x: number; y: number },
  startDir: Direction,
  end: { x: number; y: number },
  endDir: Direction,
  _objects: BoardObject[] = [],
  _excludeIds: string[] = [],
): Waypoint[] {
  // Compute an intermediate coordinate that lets us leave `start`
  // in startDir and arrive at `end` from endDir with only two bends.

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  // Helper: offset a point along a direction
  const offset = (pt: { x: number; y: number }, dir: Direction, dist: number) => {
    switch (dir) {
      case 'top':    return { x: pt.x, y: pt.y - dist };
      case 'bottom': return { x: pt.x, y: pt.y + dist };
      case 'left':   return { x: pt.x - dist, y: pt.y };
      case 'right':  return { x: pt.x + dist, y: pt.y };
    }
  };

  const isHorizontal = (d: Direction) => d === 'left' || d === 'right';

  // If both endpoints face the same axis we can route with one midpoint
  if (isHorizontal(startDir) && isHorizontal(endDir)) {
    return [
      { x: midX, y: start.y },
      { x: midX, y: end.y },
    ];
  }
  if (!isHorizontal(startDir) && !isHorizontal(endDir)) {
    return [
      { x: start.x, y: midY },
      { x: end.x, y: midY },
    ];
  }

  // Perpendicular directions — one bend at the corner
  if (isHorizontal(startDir)) {
    // Leave horizontally, arrive vertically
    const off = offset(start, startDir, MARGIN);
    return [{ x: end.x, y: off.y }];
  } else {
    // Leave vertically, arrive horizontally
    const off = offset(start, startDir, MARGIN);
    return [{ x: off.x, y: end.y }];
  }
}
