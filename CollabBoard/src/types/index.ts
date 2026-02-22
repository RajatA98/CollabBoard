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
  // Text formatting fields (for sticky notes and text elements)
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  // Stroke / border fields (shapes & lines)
  strokeColor?: string;
  strokeWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  // Line-specific fields
  arrowType?: 'none' | 'single' | 'double';
  waypoints?: Waypoint[];
  fromId?: string;
  fromPoint?: string;
  toId?: string;
  toPoint?: string;
  // Frame grouping: if set, this object is "inside" the frame and moves/resizes/rotates with it
  frameId?: string;
  // Original width/height ratio for aspect-ratio preservation on resize
  aspectRatio?: number;
  // Stacking order: higher values render on top
  zIndex?: number;
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
  username?: string;
  avatarColor?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  displayNameLower: string;
  avatarColor: string;
  createdAt: number;
  updatedAt: number;
}

export interface FriendData {
  status: 'pending_sent' | 'pending_received' | 'accepted';
  since: number;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string;
}

export interface BoardInvitation {
  boardId: string;
  boardName: string;
  invitedBy: string;
  invitedByName: string;
  invitedByUsername: string;
  invitedByAvatarColor: string;
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface CollaboratorEntry {
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted';
  invitedAt: number;
  invitedBy: string;
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
  visibility: 'open' | 'private';
  collaborators?: Record<string, CollaboratorEntry>;
  collaboratorUids?: string[];
}
