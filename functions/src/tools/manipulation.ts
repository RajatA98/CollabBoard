import * as admin from "firebase-admin";
import {assertObjectExists, assertObjectType, objectsRef} from "./helpers.js";
import {getBoardState} from "./boardState.js";

function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

/**
 * Move an object. If it's a frame, move its children (frameId === objectId) by the same delta.
 */
export async function moveObject(
  boardId: string,
  userId: string,
  input: { objectId: string; x: number; y: number }
): Promise<{ objectId: string; x: number; y: number }> {
  const snap = await assertObjectExists(boardId, input.objectId);
  const data = snap.data() as { type: string; x: number; y: number };
  const now = Date.now();
  const payload = {
    x: input.x,
    y: input.y,
    updatedAt: now,
    updatedBy: userId,
  };
  if (data.type === "frame") {
    const {objects} = await getBoardState(boardId);
    const children = objects.filter(
      (o: Record<string, unknown>) => "frameId" in o && o.frameId === input.objectId
    );
    const dx = input.x - data.x;
    const dy = input.y - data.y;
    const batch = getDb().batch();
    const ref = objectsRef(boardId).doc(input.objectId);
    batch.update(ref, payload);
    for (const child of children) {
      const childRef = objectsRef(boardId).doc(child.id as string);
      batch.update(childRef, {
        x: (child.x as number) + dx,
        y: (child.y as number) + dy,
        updatedAt: now,
        updatedBy: userId,
      });
    }
    await batch.commit();
  } else {
    await objectsRef(boardId).doc(input.objectId).update(payload);
  }
  return {objectId: input.objectId, x: input.x, y: input.y};
}

/**
 * Move many objects at once. Each move has objectId, x, y.
 */
export async function moveMultipleObjects(
  boardId: string,
  userId: string,
  input: { moves: Array<{ objectId: string; x: number; y: number }> }
): Promise<{ moved: number }> {
  const now = Date.now();
  const BATCH_SIZE = 50;
  for (let i = 0; i < input.moves.length; i += BATCH_SIZE) {
    const batch = getDb().batch();
    const chunk = input.moves.slice(i, i + BATCH_SIZE);
    for (const move of chunk) {
      await assertObjectExists(boardId, move.objectId);
      const ref = objectsRef(boardId).doc(move.objectId);
      batch.update(ref, {
        x: move.x,
        y: move.y,
        updatedAt: now,
        updatedBy: userId,
      });
    }
    await batch.commit();
  }
  return {moved: input.moves.length};
}

/**
 * Resize an object. Throws if not found.
 */
export async function resizeObject(
  boardId: string,
  userId: string,
  input: { objectId: string; width: number; height: number }
): Promise<{ objectId: string; width: number; height: number }> {
  await assertObjectExists(boardId, input.objectId);
  await objectsRef(boardId).doc(input.objectId).update({
    width: input.width,
    height: input.height,
    updatedAt: Date.now(),
    updatedBy: userId,
  });
  return {
    objectId: input.objectId,
    width: input.width,
    height: input.height,
  };
}

/**
 * Resize many objects at once (e.g. multi-select). Each item has objectId, width, height.
 * Chunks batch writes in groups of 50 for consistent AI/tool behavior.
 */
export async function resizeMultipleObjects(
  boardId: string,
  userId: string,
  input: { resizes: Array<{ objectId: string; width: number; height: number }> }
): Promise<{ resized: number }> {
  const now = Date.now();
  const BATCH_SIZE = 50;
  for (let i = 0; i < input.resizes.length; i += BATCH_SIZE) {
    const chunk = input.resizes.slice(i, i + BATCH_SIZE);
    const batch = getDb().batch();
    for (const {objectId, width, height} of chunk) {
      await assertObjectExists(boardId, objectId);
      const ref = objectsRef(boardId).doc(objectId);
      batch.update(ref, {
        width,
        height,
        updatedAt: now,
        updatedBy: userId,
      });
    }
    await batch.commit();
  }
  return {resized: input.resizes.length};
}

/** Clamp rotation to [-360, 360] to avoid unbounded values. */
function clampRotation(degrees: number): number {
  let r = degrees;
  while (r > 360) r -= 360;
  while (r < -360) r += 360;
  return r;
}

/**
 * Rotate a single object. Works for all shapes, lines, frames, sticky notes, text.
 * If the object is a frame, its contained shapes get the same rotation delta.
 */
export async function rotateObject(
  boardId: string,
  userId: string,
  input: { objectId: string; rotation: number }
): Promise<{ objectId: string; rotation: number }> {
  const snap = await assertObjectExists(boardId, input.objectId);
  const data = snap.data() as { type: string; rotation?: number };
  const now = Date.now();
  const newRot = clampRotation(input.rotation);

  if (data.type === "frame") {
    const {objects} = await getBoardState(boardId);
    const children = objects.filter(
      (o: Record<string, unknown>) => "frameId" in o && o.frameId === input.objectId
    );
    const oldFrameRot = typeof data.rotation === "number" ? data.rotation : 0;
    const rotDelta = newRot - oldFrameRot;

    const batch = getDb().batch();
    const ref = objectsRef(boardId).doc(input.objectId);
    batch.update(ref, {
      rotation: newRot,
      updatedAt: now,
      updatedBy: userId,
    });
    for (const child of children) {
      const childRef = objectsRef(boardId).doc(child.id as string);
      const childRot = typeof child.rotation === "number" ? child.rotation : 0;
      batch.update(childRef, {
        rotation: clampRotation(childRot + rotDelta),
        updatedAt: now,
        updatedBy: userId,
      });
    }
    await batch.commit();
  } else {
    await objectsRef(boardId).doc(input.objectId).update({
      rotation: newRot,
      updatedAt: now,
      updatedBy: userId,
    });
  }
  return {objectId: input.objectId, rotation: newRot};
}

/**
 * Rotate many objects at once (e.g. multi-select marquee). Each item has objectId and rotation.
 * If an object is a frame, its children get the same rotation delta.
 * Chunks batch writes in groups of 50 for consistent AI/tool behavior.
 */
export async function rotateMultipleObjects(
  boardId: string,
  userId: string,
  input: { rotations: Array<{ objectId: string; rotation: number }> }
): Promise<{ rotated: number }> {
  const now = Date.now();
  const {objects} = await getBoardState(boardId);
  const objectsById = new Map(objects.map((o: Record<string, unknown>) => [o.id as string, o]));

  type Op = { ref: admin.firestore.DocumentReference; data: Record<string, unknown> };
  const ops: Op[] = [];
  const updatedIds = new Set<string>();

  for (const {objectId, rotation} of input.rotations) {
    if (updatedIds.has(objectId)) continue;
    const obj = objectsById.get(objectId);
    if (!obj) {
      await assertObjectExists(boardId, objectId);
      continue;
    }
    const data = obj as { type?: string; rotation?: number };
    const newRot = clampRotation(rotation);
    if (data.type === "frame") {
      const children = objects.filter(
        (o: Record<string, unknown>) => "frameId" in o && o.frameId === objectId
      );
      const oldFrameRot = typeof data.rotation === "number" ? data.rotation : 0;
      const rotDelta = newRot - oldFrameRot;
      ops.push({
        ref: objectsRef(boardId).doc(objectId),
        data: {rotation: newRot, updatedAt: now, updatedBy: userId},
      });
      updatedIds.add(objectId);
      for (const child of children) {
        const childRot = typeof child.rotation === "number" ? child.rotation : 0;
        ops.push({
          ref: objectsRef(boardId).doc(child.id as string),
          data: {
            rotation: clampRotation(childRot + rotDelta),
            updatedAt: now,
            updatedBy: userId,
          },
        });
        updatedIds.add(child.id as string);
      }
    } else {
      ops.push({
        ref: objectsRef(boardId).doc(objectId),
        data: {rotation: newRot, updatedAt: now, updatedBy: userId},
      });
      updatedIds.add(objectId);
    }
  }

  const BATCH_SIZE = 50;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = getDb().batch();
    const chunk = ops.slice(i, i + BATCH_SIZE);
    for (const {ref, data} of chunk) {
      batch.update(ref, data);
    }
    await batch.commit();
  }
  return {rotated: input.rotations.length};
}

/**
 * Update text on a sticky or text object. Throws if type is not sticky or text.
 */
export async function updateText(
  boardId: string,
  _userId: string,
  input: { objectId: string; newText: string }
): Promise<{ objectId: string }> {
  const snap = await assertObjectExists(boardId, input.objectId);
  const data = snap.data() as { type: string };
  assertObjectType(data, ["sticky", "text"], "updateText only works on sticky notes and text objects");
  await objectsRef(boardId).doc(input.objectId).update({
    text: input.newText,
    updatedAt: Date.now(),
    updatedBy: _userId,
  });
  return {objectId: input.objectId};
}

/**
 * Change color of an object. Returns objectId and color per spec.
 */
export async function changeColor(
  boardId: string,
  userId: string,
  input: { objectId: string; color: string }
): Promise<{ objectId: string; color: string }> {
  await assertObjectExists(boardId, input.objectId);
  await objectsRef(boardId).doc(input.objectId).update({
    color: input.color,
    updatedAt: Date.now(),
    updatedBy: userId,
  });
  return {objectId: input.objectId, color: input.color};
}

/**
 * Delete a single object. If it's a frame, also delete all children (frameId === objectId).
 */
export async function deleteObject(
  boardId: string,
  userId: string,
  input: { objectId: string }
): Promise<{ objectId: string; deleted: true; childrenDeleted: number }> {
  const snap = await assertObjectExists(boardId, input.objectId);
  const data = snap.data() as { type: string };
  let childrenDeleted = 0;

  if (data.type === "frame") {
    const {objects} = await getBoardState(boardId);
    const children = objects.filter(
      (o: Record<string, unknown>) => "frameId" in o && o.frameId === input.objectId
    );
    const batch = getDb().batch();
    batch.delete(objectsRef(boardId).doc(input.objectId));
    for (const child of children) {
      batch.delete(objectsRef(boardId).doc(child.id as string));
    }
    await batch.commit();
    childrenDeleted = children.length;
  } else {
    await objectsRef(boardId).doc(input.objectId).delete();
  }

  return {objectId: input.objectId, deleted: true, childrenDeleted};
}

/**
 * Delete many objects at once. Chunks into batches of 50 for consistent AI/tool behavior.
 */
export async function deleteMultipleObjects(
  boardId: string,
  _userId: string,
  input: { objectIds: string[] }
): Promise<{ deleted: number }> {
  const CHUNK_SIZE = 50;
  const ids = input.objectIds;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const batch = getDb().batch();
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    for (const id of chunk) {
      batch.delete(objectsRef(boardId).doc(id));
    }
    await batch.commit();
  }

  return {deleted: ids.length};
}

/**
 * Delete every object on the board.
 */
export async function clearBoard(
  boardId: string,
  _userId: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  _input: Record<string, never> // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<{ deleted: number }> {
  const colRef = objectsRef(boardId);
  const snap = await colRef.get();

  const CHUNK_SIZE = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
    const batch = getDb().batch();
    const chunk = snap.docs.slice(i, i + CHUNK_SIZE);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  return {deleted: snap.docs.length};
}
