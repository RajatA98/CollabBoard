/**
 * Layout helpers for grid, row, column, and distribute.
 * Used by the agent to compute positions before calling moveObject.
 */

export const GRID_SPACING = 220;

/**
 * Compute grid positions (square-ish grid). Returns array of { x, y }.
 * spacing: horizontal and vertical gap between centers (default 220).
 */
export function gridPositions(
  count: number,
  startX: number,
  startY: number,
  spacingX = GRID_SPACING,
  spacingY = GRID_SPACING
): Array<{ x: number; y: number }> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: startX + col * spacingX,
      y: startY + row * spacingY,
    });
  }
  return positions;
}

/** Single row: items placed horizontally with spacing. */
export function rowPositions(
  count: number,
  startX: number,
  y: number,
  spacing = GRID_SPACING
): Array<{ x: number; y: number }> {
  return Array.from({length: count}, (_, i) => ({
    x: startX + i * spacing,
    y,
  }));
}

/** Single column: items placed vertically with spacing. */
export function columnPositions(
  count: number,
  x: number,
  startY: number,
  spacing = GRID_SPACING
): Array<{ x: number; y: number }> {
  return Array.from({length: count}, (_, i) => ({
    x,
    y: startY + i * spacing,
  }));
}

/**
 * Distribute items evenly along a line from (startX, startY) to (endX, endY).
 * count >= 1. First at start, last at end, others evenly spaced.
 */
export function distributePositions(
  count: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{x: startX, y: startY}];
  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    positions.push({
      x: startX + t * (endX - startX),
      y: startY + t * (endY - startY),
    });
  }
  return positions;
}
