import type { BoardObject } from '../types';

export type Direction = 'top' | 'right' | 'bottom' | 'left';

export interface ConnectionPoint {
  id: string;
  x: number;
  y: number;
  direction: Direction;
}

function directionFromAngle(angleDeg: number): Direction {
  if (angleDeg >= 315 || angleDeg < 45) return 'right';
  if (angleDeg >= 45 && angleDeg < 135) return 'bottom';
  if (angleDeg >= 135 && angleDeg < 225) return 'left';
  return 'top';
}

/** Rotate point (px, py) around (cx, cy) by angleDeg degrees. */
function rotatePoint(px: number, py: number, cx: number, cy: number, angleDeg: number): { x: number; y: number } {
  if (angleDeg === 0) return { x: px, y: py };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos,
  };
}

/** Safe numeric read for objects that may come from Firestore with missing fields. */
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * 8 connection points for rectangular shapes (corners + edge midpoints).
 * Applies obj.rotation so points match visual corners/edges.
 * Konva rotates Group around (x, y) = top-left, so we use that as rotation origin.
 */
function getRectPoints(obj: BoardObject): ConnectionPoint[] {
  const x = num(obj.x, 0);
  const y = num(obj.y, 0);
  const w = num(obj.width, 100);
  const h = num(obj.height, 100);
  const rot = num(obj.rotation, 0);

  const raw = [
    { id: 'top-left', x, y, direction: 'top' as const },
    { id: 'top', x: x + w / 2, y, direction: 'top' as const },
    { id: 'top-right', x: x + w, y, direction: 'top' as const },
    { id: 'right', x: x + w, y: y + h / 2, direction: 'right' as const },
    { id: 'bottom-right', x: x + w, y: y + h, direction: 'bottom' as const },
    { id: 'bottom', x: x + w / 2, y: y + h, direction: 'bottom' as const },
    { id: 'bottom-left', x, y: y + h, direction: 'bottom' as const },
    { id: 'left', x, y: y + h / 2, direction: 'left' as const },
  ];
  if (rot === 0) return raw;
  return raw.map((p) => {
    const { x: px, y: py } = rotatePoint(p.x, p.y, x, y, rot);
    return { ...p, x: px, y: py };
  });
}

/**
 * 8 connection points distributed on the ellipse circumference.
 * Applies obj.rotation so points match visual positions.
 * Konva rotates Group around (x, y) = top-left of bounding box, so we use that as rotation origin.
 */
function getCirclePoints(obj: BoardObject): ConnectionPoint[] {
  const x = num(obj.x, 0);
  const y = num(obj.y, 0);
  const w = num(obj.width, 100);
  const h = num(obj.height, 100);
  const rx = w / 2;
  const ry = h / 2;
  const rot = num(obj.rotation, 0);
  const cx = x + rx;
  const cy = y + ry;

  const ids = ['right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right'];
  const pts: ConnectionPoint[] = [];
  for (let i = 0; i < 8; i++) {
    const angleDeg = i * 45;
    const angleRad = (angleDeg * Math.PI) / 180;
    let px = cx + rx * Math.cos(angleRad);
    let py = cy + ry * Math.sin(angleRad);
    if (rot !== 0) {
      const r = rotatePoint(px, py, x, y, rot);
      px = r.x;
      py = r.y;
    }
    pts.push({
      id: ids[i],
      x: px,
      y: py,
      direction: directionFromAngle(angleDeg),
    });
  }
  return pts;
}

/**
 * 2 connection points for lines: start and end.
 */
function getLinePoints(obj: BoardObject): ConnectionPoint[] {
  const x = num(obj.x, 0);
  const y = num(obj.y, 0);
  const dx = num(obj.width, 0);
  const dy = num(obj.height, 0);
  const angle = Math.atan2(dy, dx);
  const startDir = directionFromAngle(((angle + Math.PI) * 180) / Math.PI);
  const endDir = directionFromAngle((angle * 180) / Math.PI);

  return [
    { id: 'start', x, y, direction: startDir },
    { id: 'end', x: x + dx, y: y + dy, direction: endDir },
  ];
}

/**
 * Returns connection points for any shape type.
 */
export function getConnectionPoints(obj: BoardObject): ConnectionPoint[] {
  switch (obj.type) {
    case 'circle':
      return getCirclePoints(obj);
    case 'line':
      return getLinePoints(obj);
    default:
      return getRectPoints(obj);
  }
}

/**
 * Look up a single connection point by its id.
 */
export function getConnectionPointById(
  obj: BoardObject,
  pointId: string,
): (ConnectionPoint & { direction: Direction }) | null {
  const pts = getConnectionPoints(obj);
  return pts.find((p) => p.id === pointId) ?? null;
}
