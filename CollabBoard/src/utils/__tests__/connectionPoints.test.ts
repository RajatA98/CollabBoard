import { describe, it, expect } from 'vitest';
import { getConnectionPoints, getConnectionPointById } from '../connectionPoints';
import type { BoardObject } from '../../types';

function lineObj(overrides: Partial<BoardObject> & { x: number; y: number; width: number; height: number }): BoardObject {
  return {
    id: 'line-1',
    type: 'line',
    x: 0,
    y: 0,
    width: 100,
    height: 0,
    rotation: 0,
    color: '#333',
    createdBy: 'u1',
    createdAt: 0,
    updatedAt: 0,
    updatedBy: 'u1',
    ...overrides,
  };
}

describe('connectionPoints', () => {
  describe('getConnectionPoints for lines', () => {
    it('returns start, center, and end for a straight line (no waypoints)', () => {
      const line = lineObj({ x: 10, y: 20, width: 100, height: 0 });
      const pts = getConnectionPoints(line);
      const ids = pts.map((p) => p.id);
      expect(ids).toEqual(['start', 'center', 'end']);
      expect(pts.find((p) => p.id === 'start')).toEqual({ id: 'start', x: 10, y: 20, direction: expect.any(String) });
      expect(pts.find((p) => p.id === 'center')).toEqual({ id: 'center', x: 60, y: 20, direction: expect.any(String) });
      expect(pts.find((p) => p.id === 'end')).toEqual({ id: 'end', x: 110, y: 20, direction: expect.any(String) });
    });

    it('returns start, bend-0, end (no center) for a line with one waypoint', () => {
      const line = lineObj({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        waypoints: [{ x: 50, y: 50 }],
      });
      const pts = getConnectionPoints(line);
      const ids = pts.map((p) => p.id);
      expect(ids).toEqual(['start', 'bend-0', 'end']);
      expect(pts.find((p) => p.id === 'start')?.x).toBe(0);
      expect(pts.find((p) => p.id === 'start')?.y).toBe(0);
      expect(pts.find((p) => p.id === 'bend-0')?.x).toBe(50);
      expect(pts.find((p) => p.id === 'bend-0')?.y).toBe(50);
      expect(pts.find((p) => p.id === 'end')?.x).toBe(100);
      expect(pts.find((p) => p.id === 'end')?.y).toBe(100);
    });

    it('returns start, bend-0, bend-1, end for a line with two waypoints', () => {
      const line = lineObj({
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        waypoints: [
          { x: 30, y: 10 },
          { x: 70, y: -5 },
        ],
      });
      const pts = getConnectionPoints(line);
      const ids = pts.map((p) => p.id);
      expect(ids).toEqual(['start', 'bend-0', 'bend-1', 'end']);
      expect(pts.find((p) => p.id === 'bend-0')?.x).toBe(30);
      expect(pts.find((p) => p.id === 'bend-0')?.y).toBe(10);
      expect(pts.find((p) => p.id === 'bend-1')?.x).toBe(70);
      expect(pts.find((p) => p.id === 'bend-1')?.y).toBe(-5);
    });

    it('treats empty waypoints array as no waypoints (start, center, end)', () => {
      const line = lineObj({ x: 0, y: 0, width: 50, height: 50, waypoints: [] });
      const pts = getConnectionPoints(line);
      expect(pts.map((p) => p.id)).toEqual(['start', 'center', 'end']);
    });
  });

  describe('getConnectionPointById for lines', () => {
    it('resolves bend-0 to the first waypoint', () => {
      const line = lineObj({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        waypoints: [{ x: 40, y: 60 }],
      });
      const cp = getConnectionPointById(line, 'bend-0');
      expect(cp).not.toBeNull();
      expect(cp?.x).toBe(40);
      expect(cp?.y).toBe(60);
      expect(cp?.id).toBe('bend-0');
    });

    it('resolves center for straight line', () => {
      const line = lineObj({ x: 10, y: 20, width: 80, height: 0 });
      const cp = getConnectionPointById(line, 'center');
      expect(cp?.x).toBe(50);
      expect(cp?.y).toBe(20);
    });
  });
});
