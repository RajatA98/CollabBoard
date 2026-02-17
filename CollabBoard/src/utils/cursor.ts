import type { CursorData } from '../types';

const CURSOR_COLORS = ['#FF6B6B', '#51CF66', '#339AF0', '#CC5DE8', '#FF922B', '#20C997', '#F06595'];

export function hashColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export function filterRemoteCursors(
  allCursors: Record<string, CursorData>,
  localUserId: string
): Record<string, CursorData> {
  const filtered: Record<string, CursorData> = {};
  for (const [uid, cursor] of Object.entries(allCursors)) {
    if (uid !== localUserId) {
      filtered[uid] = cursor;
    }
  }
  return filtered;
}

export function shouldThrottleCursorUpdate(lastUpdate: number, throttleMs: number): boolean {
  return Date.now() - lastUpdate < throttleMs;
}
