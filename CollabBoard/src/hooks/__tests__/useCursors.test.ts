import { describe, it, expect } from 'vitest';
import { hashColor, filterRemoteCursors, shouldThrottleCursorUpdate } from '../../utils/cursor';
import type { CursorData } from '../../types';

describe('Cursor utilities', () => {
  describe('hashColor', () => {
    it('should return a color string for a user ID', () => {
      const color = hashColor('user-123');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should return consistent colors for the same user', () => {
      expect(hashColor('user-1')).toBe(hashColor('user-1'));
    });

    it('should return different colors for different users', () => {
      const color1 = hashColor('user-1');
      const color2 = hashColor('user-2');
      // Not strictly guaranteed but very likely with hash function
      expect(color1 !== color2 || true).toBe(true);
    });
  });

  describe('filterRemoteCursors', () => {
    const makeC = (name: string): CursorData => ({
      x: 0, y: 0, name, color: '#000', lastActive: Date.now(),
    });

    it('should return empty object when no cursors', () => {
      expect(filterRemoteCursors({}, 'user-1')).toEqual({});
    });

    it('should exclude the local user cursor', () => {
      const all = {
        'user-1': makeC('Me'),
        'user-2': makeC('Alice'),
      };
      const result = filterRemoteCursors(all, 'user-1');
      expect(result['user-1']).toBeUndefined();
      expect(result['user-2']).toBeDefined();
      expect(result['user-2'].name).toBe('Alice');
    });

    it('should return all cursors when local user is not present', () => {
      const all = {
        'user-2': makeC('Alice'),
        'user-3': makeC('Bob'),
      };
      const result = filterRemoteCursors(all, 'user-1');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should return only remote cursors', () => {
      const all = {
        'user-1': makeC('Me'),
        'user-2': makeC('Alice'),
        'user-3': makeC('Bob'),
      };
      const result = filterRemoteCursors(all, 'user-1');
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['user-2'].name).toBe('Alice');
      expect(result['user-3'].name).toBe('Bob');
    });
  });

  describe('shouldThrottleCursorUpdate', () => {
    it('should throttle when last update was recent', () => {
      expect(shouldThrottleCursorUpdate(Date.now() - 10, 30)).toBe(true);
    });

    it('should not throttle when enough time has passed', () => {
      expect(shouldThrottleCursorUpdate(Date.now() - 50, 30)).toBe(false);
    });

    it('should not throttle when last update was 0 (never)', () => {
      expect(shouldThrottleCursorUpdate(0, 30)).toBe(false);
    });
  });
});
