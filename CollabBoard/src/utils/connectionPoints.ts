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
  if (angleDeg === 0 || !Number.isFinite(angleDeg)) return { x: px, y: py };
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
    { id: 'center', x: x + w / 2, y: y + h / 2, direction: 'top' as const },
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

  const pts: ConnectionPoint[] = [
    { id: 'center', x: cx, y: cy, direction: 'top' as const },
  ];
  const ids = ['right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right'];
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
 * Connection points for lines: start, optional center (straight lines only),
 * optional bend points (waypoints), and end. Directions use segment tangents.
 */
function getLinePoints(obj: BoardObject): ConnectionPoint[] {
  const x = num(obj.x, 0);
  const y = num(obj.y, 0);
  const dx = num(obj.width, 0);
  const dy = num(obj.height, 0);
  const start = { x, y };
  const end = { x: x + dx, y: y + dy };
  const waypoints = obj.waypoints && obj.waypoints.length > 0
    ? obj.waypoints.map((w) => ({ x: num(w.x, x), y: num(w.y, y) }))
    : [];

  const pts: ConnectionPoint[] = [];

  // Start: direction from first segment (start → first waypoint or end)
  const firstNext = waypoints.length > 0 ? waypoints[0] : end;
  const startAngleDeg = (Math.atan2(firstNext.y - start.y, firstNext.x - start.x) * 180) / Math.PI;
  const startDir = directionFromAngle((startAngleDeg + 360) % 360);
  pts.push({ id: 'start', x: start.x, y: start.y, direction: startDir });

  if (waypoints.length === 0) {
    // Straight line: add center at midpoint
    const centerDir = directionFromAngle((Math.atan2(dy, dx) * 180) / Math.PI);
    pts.push({
      id: 'center',
      x: x + dx / 2,
      y: y + dy / 2,
      direction: centerDir,
    });
  } else {
    // Bent line: one connection point per waypoint with tangent direction (prev → next)
    for (let i = 0; i < waypoints.length; i++) {
      const prev = i === 0 ? start : waypoints[i - 1];
      const next = i === waypoints.length - 1 ? end : waypoints[i + 1];
      const angleDeg = (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI;
      const dir = directionFromAngle((angleDeg + 360) % 360);
      pts.push({
        id: `bend-${i}`,
        x: waypoints[i].x,
        y: waypoints[i].y,
        direction: dir,
      });
    }
  }

  // End: direction from last segment (last waypoint or start → end)
  const lastPrev = waypoints.length > 0 ? waypoints[waypoints.length - 1] : start;
  const endAngleDeg = (Math.atan2(end.y - lastPrev.y, end.x - lastPrev.x) * 180) / Math.PI;
  const endDir = directionFromAngle((endAngleDeg + 360) % 360);
  pts.push({ id: 'end', x: end.x, y: end.y, direction: endDir });

  return pts;
}

/**
 * Return local-space vertices for polygon-based shapes.
 * To support a new shape, add its vertex list here — connection points are
 * computed automatically (N corners + N edge midpoints = 2N points).
 */
function getShapeVertices(obj: BoardObject): { x: number; y: number }[] | null {
  const w = num(obj.width, 100);
  const h = num(obj.height, 100);

  switch (obj.type) {
    case 'triangle':
      return [
        { x: w / 2, y: 0 },
        { x: 0, y: h },
        { x: w, y: h },
      ];
    case 'star': {
      const cx = w / 2;
      const cy = h / 2;
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.4;
      const verts: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? outerR : innerR;
        verts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
      }
      return verts;
    }
    default:
      return null;
  }
}

/**
 * Generic connection points for any polygon defined by its vertices.
 * Produces N corner points + N edge midpoints = 2N total.
 * Translates from local space to world space and applies rotation.
 */
function getPolygonPoints(obj: BoardObject, localVerts: { x: number; y: number }[]): ConnectionPoint[] {
  const ox = num(obj.x, 0);
  const oy = num(obj.y, 0);
  const rot = num(obj.rotation, 0);
  const n = localVerts.length;

  const centroidX = localVerts.reduce((s, v) => s + v.x, 0) / n;
  const centroidY = localVerts.reduce((s, v) => s + v.y, 0) / n;

  const toWorld = (lx: number, ly: number) => {
    const wx = ox + lx;
    const wy = oy + ly;
    if (rot === 0) return { x: wx, y: wy };
    return rotatePoint(wx, wy, ox, oy, rot);
  };

  const directionFor = (lx: number, ly: number): Direction => {
    const angle = Math.atan2(ly - centroidY, lx - centroidX);
    const deg = ((angle * 180) / Math.PI + 360) % 360;
    return directionFromAngle(deg);
  };

  const centerWorld = toWorld(centroidX, centroidY);
  const pts: ConnectionPoint[] = [
    { id: 'center', x: centerWorld.x, y: centerWorld.y, direction: 'top' as const },
  ];

  for (let i = 0; i < n; i++) {
    const v = localVerts[i];
    const w = toWorld(v.x, v.y);
    pts.push({ id: `corner-${i}`, x: w.x, y: w.y, direction: directionFor(v.x, v.y) });
  }

  for (let i = 0; i < n; i++) {
    const a = localVerts[i];
    const b = localVerts[(i + 1) % n];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const w = toWorld(mx, my);
    pts.push({ id: `edge-${i}`, x: w.x, y: w.y, direction: directionFor(mx, my) });
  }

  return pts;
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
    default: {
      const verts = getShapeVertices(obj);
      if (verts) return getPolygonPoints(obj, verts);
      return getRectPoints(obj);
    }
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
