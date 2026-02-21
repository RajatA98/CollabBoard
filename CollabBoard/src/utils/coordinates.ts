/**
 * Viewport transform type
 */
export interface Viewport {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Axis-aligned bounding box (world or screen space)
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Test if two axis-aligned rectangles intersect
 */
export function rectsIntersect(r1: Rect, r2: Rect): boolean {
  return !(
    r1.x + r1.width < r2.x ||
    r2.x + r2.width < r1.x ||
    r1.y + r1.height < r2.y ||
    r2.y + r2.height < r1.y
  );
}

const MAX_PLACEMENT_ATTEMPTS = 50;

/**
 * Find a non-overlapping top-left position for a rect of size (width, height).
 * Tries desired (desiredX, desiredY) first, then positions to the right, down, left, up, then spiral outward.
 * @param gap - spacing between rects (default 20)
 * @returns Top-left { x, y } that does not intersect any existing rect
 */
export function getNonOverlappingPosition(
  desiredX: number,
  desiredY: number,
  width: number,
  height: number,
  existingRects: Rect[],
  gap: number = 20
): { x: number; y: number } {
  const step = Math.max(width, Math.max(1, height)) + gap;
  const candidate: Rect = { x: 0, y: 0, width, height };

  function overlapsAny(x: number, y: number): boolean {
    candidate.x = x;
    candidate.y = y;
    return existingRects.some((r) => rectsIntersect(candidate, r));
  }

  if (!overlapsAny(desiredX, desiredY)) return { x: desiredX, y: desiredY };

  for (let ring = 1; ring < MAX_PLACEMENT_ATTEMPTS; ring++) {
    const S = ring * step;
    const positions: [number, number][] = [
      [desiredX + S, desiredY],
      [desiredX, desiredY + S],
      [desiredX - S, desiredY],
      [desiredX, desiredY - S],
    ];
    for (const [x, y] of positions) {
      if (!overlapsAny(x, y)) return { x, y };
    }
  }
  return { x: desiredX, y: desiredY };
}

/**
 * Convert screen coordinates to world coordinates.
 * World Y increases downward (same as screen Y).
 *
 * @param screenX - X coordinate in screen space
 * @param screenY - Y coordinate in screen space
 * @param viewport - Current viewport transform
 * @returns Point in world coordinates (y-down)
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: Viewport
): Point {
  return {
    x: (screenX - viewport.x) / viewport.scaleX,
    y: (screenY - viewport.y) / viewport.scaleY,
  };
}

/**
 * Convert world coordinates to screen coordinates.
 * World Y increases downward (same as screen Y).
 *
 * @param worldX - X coordinate in world space
 * @param worldY - Y coordinate in world space
 * @param viewport - Current viewport transform
 * @returns Point in screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: Viewport
): Point {
  return {
    x: worldX * viewport.scaleX + viewport.x,
    y: worldY * viewport.scaleY + viewport.y,
  };
}
