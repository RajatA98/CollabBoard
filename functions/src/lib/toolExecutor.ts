/**
 * Thin wrapper: re-exports the 9 spec tools from tools/ so agentRunner
 * and other callers keep the same import path. Adapts (boardId, input, userId?)
 * to (boardId, userId, input) where needed.
 */
import {
  getBoardState,
  createStickyNote,
  createStickyNotes as toolsCreateStickyNotes,
  createShape,
  createShapes as toolsCreateShapes,
  createFrame,
  createFrames as toolsCreateFrames,
  createTextBox,
  createTextBoxes as toolsCreateTextBoxes,
  createConnector,
  moveObject as toolsMoveObject,
  moveMultipleObjects as toolsMoveMultipleObjects,
  resizeObject as toolsResizeObject,
  resizeMultipleObjects as toolsResizeMultipleObjects,
  rotateObject as toolsRotateObject,
  rotateMultipleObjects as toolsRotateMultipleObjects,
  updateText as toolsUpdateText,
  changeColor as toolsChangeColor,
  deleteObject as toolsDeleteObject,
  deleteMultipleObjects as toolsDeleteMultipleObjects,
  clearBoard as toolsClearBoard,
} from "../tools/index.js";

export {getBoardState, createStickyNote, createShape, createFrame, createTextBox, createConnector};

const AGENT_BULK_MAX = 50;

type CreateStickyNotesInput = {
  stickies: Array<{
    text?: string;
    x: number;
    y: number;
    color: string;
    exactPosition?: boolean;
  }>;
  exactPosition?: boolean;
  _genOrigin?: { x: number; y: number };
  _baseZIndex?: number;
};

export async function createStickyNotes(
  boardId: string,
  userId: string | undefined,
  input: CreateStickyNotesInput
) {
  if ((input.stickies?.length ?? 0) > AGENT_BULK_MAX) {
    throw new Error(`createStickyNotes: max ${AGENT_BULK_MAX} per call for AI; split into batches.`);
  }
  return toolsCreateStickyNotes(boardId, userId ?? "ai", input);
}

type CreateShapesInput = {
  shapes: Array<{
    shapeType: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    waypoints?: Array<{ x: number; y: number }>;
    exactPosition?: boolean;
  }>;
  exactPosition?: boolean;
  _genOrigin?: { x: number; y: number };
  _baseZIndex?: number;
};

export async function createShapes(
  boardId: string,
  userId: string | undefined,
  input: CreateShapesInput
) {
  if ((input.shapes?.length ?? 0) > AGENT_BULK_MAX) {
    throw new Error(`createShapes: max ${AGENT_BULK_MAX} per call for AI; split into batches.`);
  }
  return toolsCreateShapes(boardId, userId ?? "ai", input);
}

type CreateTextBoxesInput = {
  textBoxes: Array<{
    text?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    exactPosition?: boolean;
  }>;
  exactPosition?: boolean;
  _genOrigin?: { x: number; y: number };
  _baseZIndex?: number;
};

export async function createTextBoxes(
  boardId: string,
  userId: string | undefined,
  input: CreateTextBoxesInput
) {
  if ((input.textBoxes?.length ?? 0) > AGENT_BULK_MAX) {
    throw new Error(`createTextBoxes: max ${AGENT_BULK_MAX} per call for AI; split into batches.`);
  }
  return toolsCreateTextBoxes(boardId, userId ?? "ai", input);
}

type CreateFramesInput = {
  frames: Array<{
    title?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    exactPosition?: boolean;
  }>;
  exactPosition?: boolean;
  _genOrigin?: { x: number; y: number };
  _baseZIndex?: number;
};

export async function createFrames(
  boardId: string,
  userId: string | undefined,
  input: CreateFramesInput
) {
  if ((input.frames?.length ?? 0) > AGENT_BULK_MAX) {
    throw new Error(`createFrames: max ${AGENT_BULK_MAX} per call for AI; split into batches.`);
  }
  return toolsCreateFrames(boardId, userId ?? "ai", input);
}

export async function moveObject(
  boardId: string,
  input: { objectId: string; x: number; y: number },
  userId?: string
) {
  return toolsMoveObject(boardId, userId ?? "ai", input);
}

export async function moveMultipleObjects(
  boardId: string,
  input: { moves: Array<{ objectId: string; x: number; y: number }> },
  userId?: string
) {
  return toolsMoveMultipleObjects(boardId, userId ?? "ai", input);
}

export async function resizeObject(
  boardId: string,
  input: { objectId: string; width: number; height: number },
  userId?: string
) {
  return toolsResizeObject(boardId, userId ?? "ai", input);
}

export async function resizeMultipleObjects(
  boardId: string,
  input: { resizes: Array<{ objectId: string; width: number; height: number }> },
  userId?: string
) {
  return toolsResizeMultipleObjects(boardId, userId ?? "ai", input);
}

export async function rotateObject(
  boardId: string,
  input: { objectId: string; rotation: number },
  userId?: string
) {
  return toolsRotateObject(boardId, userId ?? "ai", input);
}

export async function rotateMultipleObjects(
  boardId: string,
  input: { rotations: Array<{ objectId: string; rotation: number }> },
  userId?: string
) {
  return toolsRotateMultipleObjects(boardId, userId ?? "ai", input);
}

export async function updateText(
  boardId: string,
  input: { objectId: string; newText: string },
  userId?: string
) {
  return toolsUpdateText(boardId, userId ?? "ai", input);
}

export async function changeColor(
  boardId: string,
  input: { objectId: string; color: string },
  userId?: string
) {
  return toolsChangeColor(boardId, userId ?? "ai", input);
}

export async function deleteObject(
  boardId: string,
  input: { objectId: string },
  userId?: string
) {
  return toolsDeleteObject(boardId, userId ?? "ai", input);
}

export async function deleteMultipleObjects(
  boardId: string,
  input: { objectIds: string[] },
  userId?: string
) {
  return toolsDeleteMultipleObjects(boardId, userId ?? "ai", input);
}

export async function clearBoard(
  boardId: string,
  input: Record<string, never>,
  userId?: string
) {
  return toolsClearBoard(boardId, userId ?? "ai", input);
}
