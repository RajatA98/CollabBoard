import * as admin from "firebase-admin";
import {v4 as uuidv4} from "uuid";

/** Lazy Firestore access so this module can load before initializeApp() runs. */
export function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

export function objectsRef(boardId: string): admin.firestore.CollectionReference {
  return getDb().collection("boards").doc(boardId).collection("objects");
}

export function generateId(): string {
  return uuidv4();
}

/** Throws if the object does not exist. */
export async function assertObjectExists(
  boardId: string,
  objectId: string
): Promise<admin.firestore.DocumentSnapshot> {
  const ref = objectsRef(boardId).doc(objectId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Object ${objectId} not found on board`);
  }
  return snap;
}

/** Throws if object type is not in allowedTypes (e.g. updateText: sticky, text). */
export function assertObjectType(
  obj: { type?: string },
  allowedTypes: string[],
  message: string
): void {
  if (!obj.type || !allowedTypes.includes(obj.type)) {
    throw new Error(message);
  }
}

export function toRects(
  objects: Array<{ x: number; y: number; width?: number; height?: number }>
): Array<{ x: number; y: number; width: number; height: number }> {
  return objects.map((o) => ({
    x: o.x,
    y: o.y,
    width: o.width ?? 0,
    height: o.height ?? 0,
  }));
}

function rectsIntersect(
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    r1.x + r1.width < r2.x ||
    r2.x + r2.width < r1.x ||
    r1.y + r1.height < r2.y ||
    r2.y + r2.height < r1.y
  );
}

const MAX_PLACEMENT_ATTEMPTS = 50;

/**
 * Find a non-overlapping top-left position for a rect.
 */
export function getNonOverlappingPosition(
  desiredX: number,
  desiredY: number,
  width: number,
  height: number,
  existingRects: Array<{ x: number; y: number; width: number; height: number }>,
  gap = 20
): { x: number; y: number } {
  const step = Math.max(width, Math.max(1, height)) + gap;
  const candidate = {x: 0, y: 0, width, height};
  function overlapsAny(x: number, y: number): boolean {
    candidate.x = x;
    candidate.y = y;
    return existingRects.some((r) => rectsIntersect(candidate, r));
  }
  if (!overlapsAny(desiredX, desiredY)) return {x: desiredX, y: desiredY};
  for (let ring = 1; ring < MAX_PLACEMENT_ATTEMPTS; ring++) {
    const S = ring * step;
    const positions: [number, number][] = [
      [desiredX + S, desiredY],
      [desiredX, desiredY + S],
      [desiredX - S, desiredY],
      [desiredX, desiredY - S],
    ];
    for (const [x, y] of positions) {
      if (!overlapsAny(x, y)) return {x, y};
    }
  }
  return {x: desiredX, y: desiredY};
}

/** Gap (px) to the right of existing content when starting a new AI gen in empty space. */
const GEN_ORIGIN_GAP = 40;

/**
 * Origin for new AI-generated content so it always starts in empty space (to the right of
 * existing objects). Returns (0, 0) if board is empty. Uses getNonOverlappingPosition so
 * the returned point is guaranteed not to overlap any existing object.
 */
export function getOriginInEmptySpace(
  objects: Array<{ x?: number; y?: number; width?: number; height?: number }>
): { x: number; y: number } {
  if (objects.length === 0) return {x: 0, y: 0};
  const withCoords = objects.filter(
    (o): o is { x: number; y: number; width?: number; height?: number } =>
      typeof o.x === "number" && typeof o.y === "number"
  );
  const rects = toRects(withCoords);
  if (rects.length === 0) return {x: 0, y: 0};
  let maxRight = -Infinity;
  for (const o of withCoords) {
    const w = typeof o.width === "number" ? o.width : 0;
    maxRight = Math.max(maxRight, o.x + w);
  }
  const candidateX = Number.isFinite(maxRight) ? maxRight + GEN_ORIGIN_GAP : GEN_ORIGIN_GAP;
  const candidateY = 0;
  const placed = getNonOverlappingPosition(
    candidateX,
    candidateY,
    1,
    1,
    rects,
    GEN_ORIGIN_GAP
  );
  return {x: placed.x, y: placed.y};
}
