export interface Waypoint {
  x: number;
  y: number;
}

export interface BoardObject {
  id: string;
  type: 'sticky' | 'rectangle' | 'circle' | 'line' | 'text' | 'triangle' | 'star' | 'frame';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  color: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
  // Line-specific fields
  arrowType?: 'none' | 'single' | 'double';
  waypoints?: Waypoint[];
  fromId?: string;
  fromPoint?: string;
  toId?: string;
  toPoint?: string;
}

export interface CursorData {
  x: number;
  y: number;
  name: string;
  color: string;
  lastActive: number;
}

export interface PresenceData {
  name: string;
  email: string;
  color: string;
  online: boolean;
  joinedAt: number;
  lastActive?: number;
}

export interface LiveTransformData {
  objectId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  userName: string;
  userColor: string;
  lastActive: number;
}

export interface LiveEditingData {
  objectId: string;
  text: string;
  userName: string;
  userColor: string;
  lastActive: number;
}

export interface SelectionData {
  objectId: string | null;
  userName?: string;
  userColor?: string;
  lastActive: number;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
}

export interface BoardMeta {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  members: string[];
  memberNames: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  visibility: 'open';
}
