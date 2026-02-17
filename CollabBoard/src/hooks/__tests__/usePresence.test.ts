import { describe, it, expect } from 'vitest';
import { getOnlineUsers, createPresenceData } from '../../utils/presence';
import { hashColor } from '../../utils/cursor';
import type { PresenceData } from '../../types';

describe('Presence utilities', () => {
  describe('getOnlineUsers', () => {
    it('should return empty array when no presence data', () => {
      expect(getOnlineUsers({})).toEqual([]);
    });

    it('should filter out offline users', () => {
      const presence: Record<string, PresenceData> = {
        'u1': { name: 'Alice', email: 'a@t.com', color: '#f00', online: true, joinedAt: 1 },
        'u2': { name: 'Bob', email: 'b@t.com', color: '#0f0', online: false, joinedAt: 2 },
        'u3': { name: 'Carol', email: 'c@t.com', color: '#00f', online: true, joinedAt: 3 },
      };
      const online = getOnlineUsers(presence);
      expect(online).toHaveLength(2);
      expect(online.map((u) => u.name)).toContain('Alice');
      expect(online.map((u) => u.name)).toContain('Carol');
      expect(online.map((u) => u.name)).not.toContain('Bob');
    });

    it('should return all users when all are online', () => {
      const presence: Record<string, PresenceData> = {
        'u1': { name: 'Alice', email: 'a@t.com', color: '#f00', online: true, joinedAt: 1 },
        'u2': { name: 'Bob', email: 'b@t.com', color: '#0f0', online: true, joinedAt: 2 },
      };
      expect(getOnlineUsers(presence)).toHaveLength(2);
    });
  });

  describe('createPresenceData', () => {
    it('should create valid presence data', () => {
      const data = createPresenceData('Alice', 'a@t.com', '#FF6B6B');
      expect(data.name).toBe('Alice');
      expect(data.email).toBe('a@t.com');
      expect(data.color).toBe('#FF6B6B');
      expect(data.online).toBe(true);
      expect(data.joinedAt).toBeGreaterThan(0);
    });
  });

  describe('hashColor for presence', () => {
    it('should produce consistent color for same user', () => {
      const c1 = hashColor('user-abc');
      const c2 = hashColor('user-abc');
      expect(c1).toBe(c2);
    });
  });
});
