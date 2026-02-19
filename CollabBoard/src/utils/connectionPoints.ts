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

/**
 * 8 connection points for rectangular shapes (corners + edge midpoints).
 */
function getRectPoints(obj: BoardObject): ConnectionPoint[] {
  const { x, y, width: w, height: h } = obj;
  const cx = x + w / 2;
  const cy = y + h / 2;

  return [
    { id: 'top-left',  x,         y,         direction: 'top'    },
    { id: 'top',       x: cx,     y,         direction: 'top'    },
    { id: 'top-right', x: x + w,  y,         direction: 'top'    },
    { id: 'right',     x: x + w,  y: cy,     direction: 'right'  },
    { id: 'bottom-right', x: x + w, y: y + h, direction: 'bottom' },
    { id: 'bottom',    x: cx,     y: y + h,  direction: 'bottom' },
    { id: 'bottom-left', x,       y: y + h,  direction: 'bottom' },
    { id: 'left',      x,         y: cy,     direction: 'left'   },
  ];
}

/**
 * 8 connection points distributed on the ellipse circumference.
 */
function getCirclePoints(obj: BoardObject): ConnectionPoint[] {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const rx = obj.width / 2;
  const ry = obj.height / 2;

  const ids = ['right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right'];
  const pts: ConnectionPoint[] = [];
  for (let i = 0; i < 8; i++) {
    const angleDeg = i * 45;
    const angleRad = (angleDeg * Math.PI) / 180;
    pts.push({
      id: ids[i],
      x: cx + rx * Math.cos(angleRad),
      y: cy + ry * Math.sin(angleRad),
      direction: directionFromAngle(angleDeg),
    });
  }
  return pts;
}

/**
 * 2 connection points for lines: start and end.
 */
function getLinePoints(obj: BoardObject): ConnectionPoint[] {
  const dx = obj.width;
  const dy = obj.height;
  const angle = Math.atan2(dy, dx);
  const startDir = directionFromAngle(((angle + Math.PI) * 180) / Math.PI);
  const endDir = directionFromAngle((angle * 180) / Math.PI);

  return [
    { id: 'start', x: obj.x, y: obj.y, direction: startDir },
    { id: 'end', x: obj.x + obj.width, y: obj.y + obj.height, direction: endDir },
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
