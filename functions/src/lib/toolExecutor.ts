import * as admin from "firebase-admin";
import {v4 as uuidv4} from "uuid";
import type {
  AnyBoardObject,
  StickyNote,
  Shape,
  Frame,
  Connector,
} from "./types.js";

const db = admin.firestore();

function objectsCollection(boardId: string) {
  return db.collection("boards").doc(boardId).collection("objects");
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function createStickyNote(
  boardId: string,
  userId: string,
  input: {text: string; x: number; y: number; color: StickyNote["color"]}
): Promise<{objectId: string; x: number; y: number; type: string}> {
  try {
    const id = uuidv4();
    const now = Date.now();
    const obj: StickyNote = {
      id,
      type: "sticky",
      x: input.x,
      y: input.y,
      width: 200,
      height: 200,
      rotation: 0,
      text: input.text,
      color: input.color,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      locked: false,
    };
    await objectsCollection(boardId).doc(id).set(obj);
    return {objectId: id, x: obj.x, y: obj.y, type: "sticky"};
  } catch (error) {
    console.error(
      `[toolExecutor] createStickyNote failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}

export async function createShape(
  boardId: string,
  userId: string,
  input: {
    shapeType: Shape["shape"];
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }
): Promise<{objectId: string; x: number; y: number; type: string}> {
  try {
    const id = uuidv4();
    const now = Date.now();
    const obj: Shape = {
      id,
      type: "shape",
      shape: input.shapeType,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      rotation: 0,
      color: input.color,
      strokeColor: "#000000",
      strokeWidth: 2,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      locked: false,
    };
    await objectsCollection(boardId).doc(id).set(obj);
    return {objectId: id, x: obj.x, y: obj.y, type: "shape"};
  } catch (error) {
    console.error(
      `[toolExecutor] createShape failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}

export async function createFrame(
  boardId: string,
  userId: string,
  input: {title: string; x: number; y: number; width: number; height: number}
): Promise<{objectId: string; x: number; y: number; type: string}> {
  try {
    const id = uuidv4();
    const now = Date.now();
    const obj: Frame = {
      id,
      type: "frame",
      title: input.title,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      rotation: 0,
      backgroundColor: "rgba(240,240,240,0.5)",
      childIds: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      locked: false,
    };
    await objectsCollection(boardId).doc(id).set(obj);
    return {objectId: id, x: obj.x, y: obj.y, type: "frame"};
  } catch (error) {
    console.error(
      `[toolExecutor] createFrame failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}

export async function createConnector(
  boardId: string,
  userId: string,
  input: {fromId: string; toId: string; style: Connector["style"]}
): Promise<{objectId: string; type: string}> {
  try {
    // Validate that both referenced objects exist
    const fromDoc = await objectsCollection(boardId).doc(input.fromId).get();
    if (!fromDoc.exists) {
      throw new Error(`Object ${input.fromId} not found on board`);
    }
    const toDoc = await objectsCollection(boardId).doc(input.toId).get();
    if (!toDoc.exists) {
      throw new Error(`Object ${input.toId} not found on board`);
    }

    const id = uuidv4();
    const now = Date.now();
    const obj: Connector = {
      id,
      type: "connector",
      fromId: input.fromId,
      toId: input.toId,
      style: input.style,
      color: "#424242",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      locked: false,
    };
    await objectsCollection(boardId).doc(id).set(obj);
    return {objectId: id, type: "connector"};
  } catch (error) {
    console.error(
      `[toolExecutor] createConnector failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}

// ---------------------------------------------------------------------------
// MANIPULATE
// ---------------------------------------------------------------------------

export async function moveObject(
  boardId: string,
  input: {objectId: string; x: number; y: number}
): Promise<{objectId: string; x: number; y: number}> {
  try {
    const ref = objectsCollection(boardId).doc(input.objectId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(`Object ${input.objectId} not found on board`);
    }
    await ref.update({
      x: input.x,
      y: input.y,
      updatedAt: Date.now(),
    });
    return {objectId: input.objectId, x: input.x, y: input.y};
  } catch (error) {
    console.error(
      `[toolExecutor] moveObject failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}

export async function resizeObject(
  boardId: string,
  input: {objectId: string; width: number; height: number}
): Promise<{objectId: string; width: number; height: number}> {
  try {
    const ref = objectsCollection(boardId).doc(input.objectId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(`Object ${input.objectId} not found on board`);
    }
    await ref.update({
      width: input.width,
      height: input.height,
      updatedAt: Date.now(),
    });
    return {
      objectId: input.objectId,
      width: input.width,
      height: input.height,
    };
  } catch (error) {
    console.error(
      `[toolExecutor] resizeObject failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}

export async function updateText(
  boardId: string,
  input: {objectId: string; newText: string}
): Promise<{objectId: string}> {
  try {
    const ref = objectsCollection(boardId).doc(input.objectId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(`Object ${input.objectId} not found on board`);
    }
    const data = snap.data() as AnyBoardObject;
    if (data.type !== "sticky") {
      throw new Error("updateText only works on sticky notes");
    }
    await ref.update({
      text: input.newText,
      updatedAt: Date.now(),
    });
    return {objectId: input.objectId};
  } catch (error) {
    console.error(
      `[toolExecutor] updateText failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}

export async function changeColor(
  boardId: string,
  input: {objectId: string; color: string}
): Promise<{objectId: string}> {
  try {
    const ref = objectsCollection(boardId).doc(input.objectId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(`Object ${input.objectId} not found on board`);
    }
    await ref.update({
      color: input.color,
      updatedAt: Date.now(),
    });
    return {objectId: input.objectId};
  } catch (error) {
    console.error(
      `[toolExecutor] changeColor failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function getBoardState(
  boardId: string
): Promise<AnyBoardObject[]> {
  try {
    const snapshot = await objectsCollection(boardId).get();
    if (snapshot.empty) return [];
    return snapshot.docs.map((doc) => doc.data() as AnyBoardObject);
  } catch (error) {
    console.error(
      `[toolExecutor] getBoardState failed on board ${boardId}:`,
      error
    );
    throw error;
  }
}
