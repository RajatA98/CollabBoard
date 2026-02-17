import { describe, it, expect } from 'vitest';
import { getOnlineUsers, getMergedOnlineUsers, createPresenceData } from '../../utils/presence';
import { hashColor } from '../../utils/cursor';
import type { PresenceData } from '../../types';

describe('Presence utilities', () => {
  describe('getOnlineUsers', () => {
    it('should return empty array when no presence data', () => {
      expect(getOnlineUsers({})).toEqual([]);
    });

    it('should return empty array when presence is null or undefined', () => {
      expect(getOnlineUsers(null)).toEqual([]);
      expect(getOnlineUsers(undefined)).toEqual([]);
    });

    it('should filter out offline users', () => {
      const now = Date.now();
      const presence: Record<string, PresenceData> = {
        'u1': { name: 'Alice', email: 'a@t.com', color: '#f00', online: true, joinedAt: now, lastActive: now },
        'u2': { name: 'Bob', email: 'b@t.com', color: '#0f0', online: false, joinedAt: now, lastActive: now },
        'u3': { name: 'Carol', email: 'c@t.com', color: '#00f', online: true, joinedAt: now, lastActive: now },
      };
      const online = getOnlineUsers(presence);
      expect(online).toHaveLength(2);
      expect(online.map((u) => u.name)).toContain('Alice');
      expect(online.map((u) => u.name)).toContain('Carol');
      expect(online.map((u) => u.name)).not.toContain('Bob');
    });

    it('should return all users when all are online', () => {
      const now = Date.now();
      const presence: Record<string, PresenceData> = {
        'u1': { name: 'Alice', email: 'a@t.com', color: '#f00', online: true, joinedAt: now, lastActive: now },
        'u2': { name: 'Bob', email: 'b@t.com', color: '#0f0', online: true, joinedAt: now, lastActive: now },
      };
      expect(getOnlineUsers(presence)).toHaveLength(2);
    });

    it('should filter out stale users (lastActive older than 15s)', () => {
      const now = Date.now();
      const old = now - 20000;
      const presence: Record<string, PresenceData> = {
        'u1': { name: 'Alice', email: 'a@t.com', color: '#f00', online: true, joinedAt: now, lastActive: now },
        'u2': { name: 'Bob', email: 'b@t.com', color: '#0f0', online: true, joinedAt: old, lastActive: old },
      };
      const online = getOnlineUsers(presence);
      expect(online).toHaveLength(1);
      expect(online[0].name).toBe('Alice');
    });
  });

  describe('getMergedOnlineUsers', () => {
    it('should merge presence and cursors; cursor active means user is online', () => {
      const now = Date.now();
      const presence: Record<string, PresenceData> = {
        'u1': { name: 'Alice', email: 'a@t.com', color: '#f00', online: true, joinedAt: now, lastActive: now },
      };
      const cursors: Record<string, import('../../types').CursorData> = {
        'u2': { x: 0, y: 0, name: 'Bob', color: '#0f0', lastActive: now },
      };
      const result = getMergedOnlineUsers(presence, cursors, 'u0', null, {
        name: 'Self',
        color: '#00f',
      });
      expect(result.length).toBe(3);
      expect(result.map((u) => u.name)).toContain('Alice');
      expect(result.map((u) => u.name)).toContain('Bob');
      expect(result.map((u) => u.name)).toContain('Self');
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

    it('should use Anonymous when name and email are empty', () => {
      const data = createPresenceData('', '', '#FF6B6B');
      expect(data.name).toBe('Anonymous');
      expect(data.email).toBe('unknown');
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
