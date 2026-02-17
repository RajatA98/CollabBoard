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
 * Convert screen coordinates to world coordinates
 * Takes into account viewport position and scale
 * 
 * @param screenX - X coordinate in screen space
 * @param screenY - Y coordinate in screen space
 * @param viewport - Current viewport transform
 * @returns Point in world coordinates
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
 * Convert world coordinates to screen coordinates
 * Takes into account viewport position and scale
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
