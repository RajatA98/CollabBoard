import { describe, it, expect } from 'vitest';
import { screenToWorld, worldToScreen, rectsIntersect } from '../coordinates';

describe('coordinates utility (y-down: world Y increases downward like screen)', () => {
  describe('screenToWorld', () => {
    it('should convert screen coordinates to world coordinates with no transform', () => {
      const viewport = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      const result = screenToWorld(100, 200, viewport);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should convert screen coordinates to world coordinates with translation', () => {
      const viewport = { x: 50, y: 100, scaleX: 1, scaleY: 1 };
      const result = screenToWorld(100, 200, viewport);
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('should convert screen coordinates to world coordinates with scale', () => {
      const viewport = { x: 0, y: 0, scaleX: 2, scaleY: 2 };
      const result = screenToWorld(100, 200, viewport);
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('should convert screen coordinates to world coordinates with both translation and scale', () => {
      const viewport = { x: 100, y: 50, scaleX: 2, scaleY: 2 };
      const result = screenToWorld(200, 150, viewport);
      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should handle fractional scale values', () => {
      const viewport = { x: 0, y: 0, scaleX: 0.5, scaleY: 0.5 };
      const result = screenToWorld(100, 200, viewport);
      expect(result).toEqual({ x: 200, y: 400 });
    });
  });

  describe('worldToScreen', () => {
    it('should convert world coordinates to screen coordinates with no transform', () => {
      const viewport = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      const result = worldToScreen(100, 200, viewport);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should convert world coordinates to screen coordinates with translation', () => {
      const viewport = { x: 50, y: 100, scaleX: 1, scaleY: 1 };
      const result = worldToScreen(100, 200, viewport);
      expect(result).toEqual({ x: 150, y: 300 });
    });

    it('should convert world coordinates to screen coordinates with scale', () => {
      const viewport = { x: 0, y: 0, scaleX: 2, scaleY: 2 };
      const result = worldToScreen(100, 200, viewport);
      expect(result).toEqual({ x: 200, y: 400 });
    });

    it('should convert world coordinates to screen coordinates with both translation and scale', () => {
      const viewport = { x: 100, y: 50, scaleX: 2, scaleY: 2 };
      const result = worldToScreen(100, 200, viewport);
      expect(result).toEqual({ x: 300, y: 450 });
    });

    it('should be inverse of screenToWorld', () => {
      const viewport = { x: 123.45, y: 67.89, scaleX: 1.5, scaleY: 1.5 };
      const screenX = 250;
      const screenY = 350;

      const world = screenToWorld(screenX, screenY, viewport);
      const backToScreen = worldToScreen(world.x, world.y, viewport);

      expect(backToScreen.x).toBeCloseTo(screenX, 5);
      expect(backToScreen.y).toBeCloseTo(screenY, 5);
    });
  });

  describe('rectsIntersect', () => {
    it('returns true when rectangles overlap', () => {
      expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    });
    it('returns false when rectangles do not touch', () => {
      expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 })).toBe(false);
    });
    it('returns true when rectangles touch on edge', () => {
      expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(true);
    });
  });
});
