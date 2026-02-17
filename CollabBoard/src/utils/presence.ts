import type { PresenceData, CursorData } from '../types';

/** Presence/cursor older than this (ms) is considered offline */
export const PRESENCE_STALE_MS = 15000;

export function getOnlineUsers(
  presence: Record<string, PresenceData> | null | undefined,
  staleMs: number = PRESENCE_STALE_MS
): PresenceData[] {
  if (!presence || typeof presence !== 'object') return [];
  const now = Date.now();
  return Object.values(presence).filter((p) => {
    if (!p || p.online !== true) return false;
    const lastActive = p.lastActive ?? p.joinedAt ?? 0;
    return now - lastActive <= staleMs;
  });
}

/**
 * Merge online users from presence and cursors. If a user has an active cursor, they are online
 * (cursor is source of truth for activity). Presence may not have been set yet for new joiners.
 */
export function getMergedOnlineUsers(
  presence: Record<string, PresenceData> | null | undefined,
  cursors: Record<string, CursorData>,
  localUserId: string,
  localUserPresence: PresenceData | null,
  localUserFallback?: { name: string; color: string }
): PresenceData[] {
  const staleMs = PRESENCE_STALE_MS;
  const now = Date.now();
  const seen = new Set<string>();
  const result: PresenceData[] = [];

  const isStale = (lastActive: number) => now - lastActive > staleMs;

  // Add local user first - we are always "online" while viewing the board
  if (localUserId) {
    if (localUserPresence) {
      const lastActive = localUserPresence.lastActive ?? localUserPresence.joinedAt ?? 0;
      if (!isStale(lastActive)) {
        result.push(localUserPresence);
        seen.add(localUserId);
      }
    } else if (localUserFallback) {
      result.push({
        name: localUserFallback.name,
        email: 'unknown',
        color: localUserFallback.color,
        online: true,
        joinedAt: now,
        lastActive: now,
      });
      seen.add(localUserId);
    }
  }

  // Add users from cursors (cursor active = user is online); cursors excludes self
  for (const [uid, cursor] of Object.entries(cursors)) {
    if (seen.has(uid)) continue;
    if (!cursor?.lastActive || isStale(cursor.lastActive)) continue;
    result.push({
      name: cursor.name || 'Anonymous',
      email: 'unknown',
      color: cursor.color,
      online: true,
      joinedAt: cursor.lastActive,
      lastActive: cursor.lastActive,
    });
    seen.add(uid);
  }

  // Add users from presence not already in cursors
  if (presence && typeof presence === 'object') {
    for (const [uid, p] of Object.entries(presence)) {
      if (seen.has(uid)) continue;
      if (!p || p.online !== true) continue;
      const lastActive = p.lastActive ?? p.joinedAt ?? 0;
      if (isStale(lastActive)) continue;
      result.push(p);
      seen.add(uid);
    }
  }

  return result;
}

export function createPresenceData(
  name: string,
  email: string,
  color: string,
  lastActive?: number
): PresenceData {
  const safeName = (name || email || 'Anonymous').trim() || 'Anonymous';
  const safeEmail = (email || '').trim() || 'unknown';
  const now = Date.now();
  return {
    name: safeName,
    email: safeEmail,
    color,
    online: true,
    joinedAt: now,
    lastActive: lastActive ?? now,
  };
}
