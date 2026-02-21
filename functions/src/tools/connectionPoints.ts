/**
 * Backend mirror of frontend connection point logic.
 * Given shape data from Firestore and a pointId, returns world {x, y}.
 * Used by createConnector when fromPoint/toPoint are specified.
 */

export interface ShapeData {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

interface Point {
  id: string;
  x: number;
  y: number;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number
): {x: number; y: number} {
  if (angleDeg === 0 || !Number.isFinite(angleDeg)) return {x: px, y: py};
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos,
  };
}

function getRectPoints(data: ShapeData): Point[] {
  const x = num(data.x, 0);
  const y = num(data.y, 0);
  const w = num(data.width, 100);
  const h = num(data.height, 100);
  const rot = num(data.rotation, 0);
  const raw: Point[] = [
    {id: "center", x: x + w / 2, y: y + h / 2},
    {id: "top-left", x, y},
    {id: "top", x: x + w / 2, y},
    {id: "top-right", x: x + w, y},
    {id: "right", x: x + w, y: y + h / 2},
    {id: "bottom-right", x: x + w, y: y + h},
    {id: "bottom", x: x + w / 2, y: y + h},
    {id: "bottom-left", x, y: y + h},
    {id: "left", x, y: y + h / 2},
  ];
  if (rot === 0) return raw;
  return raw.map((p) => {
    const {x: px, y: py} = rotatePoint(p.x, p.y, x, y, rot);
    return {id: p.id, x: px, y: py};
  });
}

function getCirclePoints(data: ShapeData): Point[] {
  const x = num(data.x, 0);
  const y = num(data.y, 0);
  const w = num(data.width, 100);
  const h = num(data.height, 100);
  const rx = w / 2;
  const ry = h / 2;
  const rot = num(data.rotation, 0);
  const cx = x + rx;
  const cy = y + ry;
  const pts: Point[] = [{id: "center", x: cx, y: cy}];
  const ids = [
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
    "top-left",
    "top",
    "top-right",
  ];
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
    pts.push({id: ids[i], x: px, y: py});
  }
  return pts;
}

function getLinePoints(data: ShapeData): Point[] {
  const x = num(data.x, 0);
  const y = num(data.y, 0);
  const dx = num(data.width, 0);
  const dy = num(data.height, 0);
  return [
    {id: "center", x: x + dx / 2, y: y + dy / 2},
    {id: "start", x, y},
    {id: "end", x: x + dx, y: y + dy},
  ];
}

function getShapeVertices(data: ShapeData): {x: number; y: number}[] | null {
  const w = num(data.width, 100);
  const h = num(data.height, 100);
  switch (data.type) {
  case "triangle":
    return [
      {x: w / 2, y: 0},
      {x: 0, y: h},
      {x: w, y: h},
    ];
  case "star": {
    const cx = w / 2;
    const cy = h / 2;
    const outerR = Math.min(w, h) / 2;
    const innerR = outerR * 0.4;
    const verts: {x: number; y: number}[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? outerR : innerR;
      verts.push({x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle)});
    }
    return verts;
  }
  default:
    return null;
  }
}

function getPolygonPoints(
  data: ShapeData,
  localVerts: {x: number; y: number}[]
): Point[] {
  const ox = num(data.x, 0);
  const oy = num(data.y, 0);
  const rot = num(data.rotation, 0);
  const n = localVerts.length;
  const centroidX = localVerts.reduce((s, v) => s + v.x, 0) / n;
  const centroidY = localVerts.reduce((s, v) => s + v.y, 0) / n;
  const toWorld = (lx: number, ly: number) => {
    const wx = ox + lx;
    const wy = oy + ly;
    if (rot === 0) return {x: wx, y: wy};
    return rotatePoint(wx, wy, ox, oy, rot);
  };
  const centerWorld = toWorld(centroidX, centroidY);
  const pts: Point[] = [{id: "center", x: centerWorld.x, y: centerWorld.y}];
  for (let i = 0; i < n; i++) {
    const v = localVerts[i];
    const w = toWorld(v.x, v.y);
    pts.push({id: `corner-${i}`, x: w.x, y: w.y});
  }
  for (let i = 0; i < n; i++) {
    const a = localVerts[i];
    const b = localVerts[(i + 1) % n];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const w = toWorld(mx, my);
    pts.push({id: `edge-${i}`, x: w.x, y: w.y});
  }
  return pts;
}

function getConnectionPointsForShape(data: ShapeData): Point[] {
  switch (data.type) {
  case "circle":
    return getCirclePoints(data);
  case "line":
    return getLinePoints(data);
  default: {
    const verts = getShapeVertices(data);
    if (verts) return getPolygonPoints(data, verts);
    return getRectPoints(data);
  }
  }
}

/**
 * Return world {x, y} for a connection point on a shape, or null if pointId not found.
 * ShapeData should have type, x, y, width, height, rotation (from Firestore).
 */
export function getConnectionPointInWorld(
  data: ShapeData,
  pointId: string
): {x: number; y: number} | null {
  const pts = getConnectionPointsForShape(data);
  const p = pts.find((pt) => pt.id === pointId);
  return p ? {x: p.x, y: p.y} : null;
}

/**
 * Return shape center in world coords. Use as fallback when fromPoint/toPoint missing or invalid.
 */
export function getShapeCenter(data: ShapeData): {x: number; y: number} {
  const x = num(data.x, 0);
  const y = num(data.y, 0);
  const w = num(data.width, 0);
  const h = num(data.height, 0);
  return {x: x + w / 2, y: y + h / 2};
}
