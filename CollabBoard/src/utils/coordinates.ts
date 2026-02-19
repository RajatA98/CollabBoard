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
