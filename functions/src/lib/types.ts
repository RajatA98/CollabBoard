export interface BoardObject {
  id: string;
  type: "sticky" | "shape" | "frame" | "connector";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
  locked: boolean;
  /** When set, this object is inside the frame with this id; used when moving a frame with its children. */
  frameId?: string;
}

export interface StickyNote extends BoardObject {
  type: "sticky";
  text: string;
  color: "yellow" | "pink" | "blue" | "green" | "purple" | "orange";
}

export interface Shape extends BoardObject {
  type: "shape";
  shape: "rectangle" | "circle" | "line";
  color: string;
  strokeColor: string;
  strokeWidth: number;
}

export interface Frame extends BoardObject {
  type: "frame";
  title: string;
  backgroundColor: string;
  childIds: string[];
}

export interface Connector extends BoardObject {
  type: "connector";
  fromId: string;
  toId: string;
  style: "arrow" | "line" | "dashed";
  color: string;
}

export type AnyBoardObject = StickyNote | Shape | Frame | Connector;
