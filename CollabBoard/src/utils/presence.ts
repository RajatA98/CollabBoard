import type { PresenceData } from '../types';

export function getOnlineUsers(presence: Record<string, PresenceData>): PresenceData[] {
  return Object.values(presence).filter((p) => p.online);
}

export function createPresenceData(
  name: string,
  email: string,
  color: string
): PresenceData {
  return {
    name,
    email,
    color,
    online: true,
    joinedAt: Date.now(),
  };
}
