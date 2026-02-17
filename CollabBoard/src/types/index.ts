export interface BoardObject {
  id: string;
  type: 'sticky' | 'rectangle';
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

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
}
