import {
  objectsRef,
  getDb,
  generateId,
  getNonOverlappingPosition,
  toRects,
  getOriginInEmptySpace,
  assertObjectExists,
  findContainingFrame,
} from "./helpers.js";
import {getBoardState} from "./boardState.js";
import {STICKY_COLOR_HEX} from "./types.js";
import {getConnectionPointInWorld, getShapeCenter} from "./connectionPoints.js";

const DEFAULT_FRAME_COLOR = "#3366ff";

const STICKY_WIDTH = 200;
const STICKY_HEIGHT = 200;

const TEXT_BOX_DEFAULT_WIDTH = 200;
const TEXT_BOX_DEFAULT_HEIGHT = 40;

type ObstacleRect = { x: number; y: number; width: number; height: number };

function stickyColorToHex(color: string): string {
  if (color.trim().startsWith("#")) return color;
  return STICKY_COLOR_HEX[color] ?? "#FFD700";
}

type GenOrigin = { x: number; y: number };

type FrameRect = { id: string; x: number; y: number; width: number; height: number };

/** Extract frame rects from a board-state objects array. */
function extractFrames(
  objects: Array<Record<string, unknown>>
): FrameRect[] {
  return objects
    .filter((o) => o.type === "frame")
    .map((o) => ({
      id: String(o.id),
      x: typeof o.x === "number" ? o.x : 0,
      y: typeof o.y === "number" ? o.y : 0,
      width: typeof o.width === "number" ? o.width : 0,
      height: typeof o.height === "number" ? o.height : 0,
    }));
}

/** Fetch only the frame rects for a board (lightweight). */
async function fetchFrames(boardId: string): Promise<FrameRect[]> {
  const {objects} = await getBoardState(boardId);
  return extractFrames(objects);
}

/** Resolve frame position for frame-relative placement. Throws if not a frame. */
async function getFrameOrigin(
  boardId: string,
  frameId: string
): Promise<{ x: number; y: number }> {
  const snap = await assertObjectExists(boardId, frameId);
  const data = snap.data() as { type?: string; x?: number; y?: number };
  if (data.type !== "frame") {
    throw new Error(`Object ${frameId} is not a frame`);
  }
  const x = typeof data.x === "number" ? data.x : 0;
  const y = typeof data.y === "number" ? data.y : 0;
  return {x, y};
}

/**
 * Create a sticky note. Writes frontend-compatible doc: type 'sticky', color as hex.
 * If exactPosition is true, place at (x, y) without shifting; use for drawings.
 * additionalObstacles: rects from shapes created earlier in the same turn (avoids overlap).
 * genOrigin: when set (first creation in a turn), place in empty space to the right of existing content.
 */
export async function createStickyNote(
  boardId: string,
  userId: string,
  input: { text?: string; x: number; y: number; color: string; exactPosition?: boolean; frameId?: string },
  additionalObstacles?: ObstacleRect[],
  genOrigin?: GenOrigin,
  zIndex?: number
): Promise<{ objectId: string; x: number; y: number; type: string; width: number; height: number }> {
  let x: number;
  let y: number;
  let frameId: string | undefined;
  if (input.frameId) {
    const origin = await getFrameOrigin(boardId, input.frameId);
    x = origin.x + input.x;
    y = origin.y + input.y;
    frameId = input.frameId;
  } else if (input.exactPosition) {
    // Still apply genOrigin so drawings start in empty space; relative layout is preserved.
    x = genOrigin ? genOrigin.x + input.x : input.x;
    y = genOrigin ? genOrigin.y + input.y : input.y;
  } else {
    const {objects} = await getBoardState(boardId);
    const desiredX = genOrigin ? genOrigin.x + input.x : input.x;
    const desiredY = genOrigin ? genOrigin.y + input.y : input.y;
    const fromBoard = toRects(
      objects.filter((o: { type: string }) => o.type !== "frame") as unknown as Array<{
        x: number;
        y: number;
        width?: number;
        height?: number;
      }>
    );
    const obstacles = additionalObstacles?.length
      ? [...fromBoard, ...additionalObstacles]
      : fromBoard;
    const placed = getNonOverlappingPosition(desiredX, desiredY, STICKY_WIDTH, STICKY_HEIGHT, obstacles, 20);
    x = placed.x;
    y = placed.y;
  }
  const id = generateId();
  const now = Date.now();
  const obj: Record<string, unknown> = {
    id,
    type: "sticky",
    x,
    y,
    width: STICKY_WIDTH,
    height: STICKY_HEIGHT,
    rotation: 0,
    text: input.text ?? "",
    color: stickyColorToHex(input.color),
    strokeWidth: 0,
    zIndex: zIndex ?? 0,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  };
  if (frameId === undefined) {
    const frames = await fetchFrames(boardId);
    frameId = findContainingFrame(x, y, STICKY_WIDTH, STICKY_HEIGHT, frames);
  }
  if (frameId !== undefined) {
    obj.frameId = frameId;
  }
  await objectsRef(boardId).doc(id).set(obj);
  return {objectId: id, x: obj.x as number, y: obj.y as number, type: "sticky", width: STICKY_WIDTH, height: STICKY_HEIGHT};
}

type StickySpec = {
  text?: string;
  x: number;
  y: number;
  color: string;
  exactPosition?: boolean;
  frameId?: string;
};

/**
 * Create many sticky notes in one call (e.g. grids with stickies). Uses a single
 * board-state read and batched Firestore writes. Max 500 per call.
 * exactPosition defaults to true so grid coordinates are exact.
 */
export async function createStickyNotes(
  boardId: string,
  userId: string,
  input: {
    stickies: StickySpec[];
    exactPosition?: boolean;
    frameId?: string;
    _genOrigin?: GenOrigin;
    _baseZIndex?: number;
  }
): Promise<{
  created: number;
  objectIds: string[];
  results: Array<{ objectId: string; x: number; y: number; width: number; height: number }>;
}> {
  const stickies = input.stickies ?? [];
  if (stickies.length === 0) {
    return {created: 0, objectIds: [], results: []};
  }
  if (stickies.length > BULK_CREATE_MAX) {
    throw new Error(`createStickyNotes: max ${BULK_CREATE_MAX} stickies per call, got ${stickies.length}`);
  }

  const defaultExact = input.exactPosition ?? true;
  const topLevelFrameId = input.frameId;
  const hasAnyFrameId = topLevelFrameId != null || stickies.some((s) => s.frameId != null);
  const hasNonExact = stickies.some((s) => (s.exactPosition ?? defaultExact) === false);
  let genOrigin = input._genOrigin;
  let baseZIndex = input._baseZIndex;
  let fromBoard: Array<{ x: number; y: number; width: number; height: number }> = [];
  const frameOriginCache = new Map<string, { x: number; y: number }>();
  async function resolveFrameOrigin(fid: string): Promise<{ x: number; y: number }> {
    let origin = frameOriginCache.get(fid);
    if (!origin) {
      origin = await getFrameOrigin(boardId, fid);
      frameOriginCache.set(fid, origin);
    }
    return origin;
  }
  if ((!genOrigin || baseZIndex === undefined || hasNonExact) && !hasAnyFrameId) {
    const {objects} = await getBoardState(boardId);
    if (!genOrigin) {
      genOrigin = getOriginInEmptySpace(
        objects.filter((o: { type?: string }) => o.type !== "frame") as unknown as Array<{
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        }>
      );
    }
    if (baseZIndex === undefined) {
      const objectsWithZ = objects as Array<Record<string, unknown> & { zIndex?: number }>;
      baseZIndex =
        objectsWithZ.reduce(
          (max: number, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0),
          0
        ) + 1;
    }
    if (hasNonExact) {
      fromBoard = toRects(
        objects.filter((o: { type: string }) => o.type !== "frame") as unknown as Array<{
          x: number;
          y: number;
          width?: number;
          height?: number;
        }>
      );
    }
  }
  if (hasAnyFrameId && baseZIndex === undefined) {
    const {objects} = await getBoardState(boardId);
    const objectsWithZ = objects as Array<Record<string, unknown> & { zIndex?: number }>;
    baseZIndex =
      objectsWithZ.reduce(
        (max: number, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0),
        0
      ) + 1;
  }
  const resolvedOrigin = genOrigin ?? {x: 0, y: 0};
  const resolvedBaseZ = baseZIndex ?? 1;
  const obstacles: Array<{ x: number; y: number; width: number; height: number }> = [...fromBoard];
  const frames = await fetchFrames(boardId);
  const now = Date.now();
  const results: Array<{ objectId: string; x: number; y: number; width: number; height: number }> = [];
  const ref = objectsRef(boardId);
  let batch = getDb().batch();
  let opsInBatch = 0;

  for (let i = 0; i < stickies.length; i++) {
    const spec = stickies[i];
    const itemFrameId = spec.frameId ?? topLevelFrameId;
    let x: number;
    let y: number;
    let outFrameId: string | undefined;
    if (itemFrameId) {
      const origin = await resolveFrameOrigin(itemFrameId);
      x = origin.x + spec.x;
      y = origin.y + spec.y;
      outFrameId = itemFrameId;
    } else {
      const exact = spec.exactPosition ?? defaultExact;
      if (exact) {
        x = resolvedOrigin.x + spec.x;
        y = resolvedOrigin.y + spec.y;
      } else {
        const placed = getNonOverlappingPosition(
          resolvedOrigin.x + spec.x,
          resolvedOrigin.y + spec.y,
          STICKY_WIDTH,
          STICKY_HEIGHT,
          obstacles,
          20
        );
        x = placed.x;
        y = placed.y;
      }
      outFrameId = findContainingFrame(x, y, STICKY_WIDTH, STICKY_HEIGHT, frames);
    }
    obstacles.push({x, y, width: STICKY_WIDTH, height: STICKY_HEIGHT});

    const id = generateId();
    const zIndex = resolvedBaseZ + i;
    const obj: Record<string, unknown> = {
      id,
      type: "sticky",
      x,
      y,
      width: STICKY_WIDTH,
      height: STICKY_HEIGHT,
      rotation: 0,
      text: spec.text ?? "",
      color: stickyColorToHex(spec.color),
      strokeWidth: 0,
      zIndex,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    };
    if (outFrameId !== undefined) {
      obj.frameId = outFrameId;
    }
    batch.set(ref.doc(id), obj);
    opsInBatch++;
    results.push({objectId: id, x, y, width: STICKY_WIDTH, height: STICKY_HEIGHT});

    if (opsInBatch >= FIRESTORE_BATCH_SIZE) {
      await batch.commit();
      batch = getDb().batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) {
    await batch.commit();
  }

  return {
    created: results.length,
    objectIds: results.map((r) => r.objectId),
    results,
  };
}

/**
 * Create a text box. Writes frontend-compatible doc: type 'text', transparent background.
 * If exactPosition is true, place at (x, y) without shifting.
 * additionalObstacles and genOrigin work like createStickyNote.
 */
export async function createTextBox(
  boardId: string,
  userId: string,
  input: {
    text?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    exactPosition?: boolean;
    frameId?: string;
  },
  additionalObstacles?: ObstacleRect[],
  genOrigin?: GenOrigin,
  zIndex?: number
): Promise<{ objectId: string; x: number; y: number; type: string; width: number; height: number }> {
  const width = input.width ?? TEXT_BOX_DEFAULT_WIDTH;
  const height = input.height ?? TEXT_BOX_DEFAULT_HEIGHT;
  let x: number;
  let y: number;
  let frameId: string | undefined;
  if (input.frameId) {
    const origin = await getFrameOrigin(boardId, input.frameId);
    x = origin.x + input.x;
    y = origin.y + input.y;
    frameId = input.frameId;
  } else if (input.exactPosition) {
    x = genOrigin ? genOrigin.x + input.x : input.x;
    y = genOrigin ? genOrigin.y + input.y : input.y;
  } else {
    const {objects} = await getBoardState(boardId);
    const desiredX = genOrigin ? genOrigin.x + input.x : input.x;
    const desiredY = genOrigin ? genOrigin.y + input.y : input.y;
    const fromBoard = toRects(
      objects.filter((o: { type: string }) => o.type !== "frame") as unknown as Array<{
        x: number;
        y: number;
        width?: number;
        height?: number;
      }>
    );
    const obstacles = additionalObstacles?.length
      ? [...fromBoard, ...additionalObstacles]
      : fromBoard;
    const placed = getNonOverlappingPosition(desiredX, desiredY, width, height, obstacles, 20);
    x = placed.x;
    y = placed.y;
  }
  const id = generateId();
  const now = Date.now();
  const obj: Record<string, unknown> = {
    id,
    type: "text",
    x,
    y,
    width,
    height,
    rotation: 0,
    text: input.text ?? "",
    color: "transparent",
    strokeWidth: 0,
    zIndex: zIndex ?? 0,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  };
  if (frameId === undefined) {
    const frames = await fetchFrames(boardId);
    frameId = findContainingFrame(x, y, width, height, frames);
  }
  if (frameId !== undefined) {
    obj.frameId = frameId;
  }
  await objectsRef(boardId).doc(id).set(obj);
  return {objectId: id, x: obj.x as number, y: obj.y as number, type: "text", width, height};
}

type TextBoxSpec = {
  text?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  exactPosition?: boolean;
  frameId?: string;
};

/**
 * Create many text boxes in one call (e.g. grids of labels). Max 500 per call.
 */
export async function createTextBoxes(
  boardId: string,
  userId: string,
  input: {
    textBoxes: TextBoxSpec[];
    exactPosition?: boolean;
    frameId?: string;
    _genOrigin?: GenOrigin;
    _baseZIndex?: number;
  }
): Promise<{
  created: number;
  objectIds: string[];
  results: Array<{ objectId: string; x: number; y: number; width: number; height: number }>;
}> {
  const textBoxes = input.textBoxes ?? [];
  if (textBoxes.length === 0) {
    return {created: 0, objectIds: [], results: []};
  }
  if (textBoxes.length > BULK_CREATE_MAX) {
    throw new Error(`createTextBoxes: max ${BULK_CREATE_MAX} text boxes per call, got ${textBoxes.length}`);
  }

  const defaultExact = input.exactPosition ?? true;
  const topLevelFrameId = input.frameId;
  const hasAnyFrameId = topLevelFrameId != null || textBoxes.some((s) => s.frameId != null);
  const hasNonExact = textBoxes.some((s) => (s.exactPosition ?? defaultExact) === false);
  let genOrigin = input._genOrigin;
  let baseZIndex = input._baseZIndex;
  let fromBoard: Array<{ x: number; y: number; width: number; height: number }> = [];
  const frameOriginCache = new Map<string, { x: number; y: number }>();
  async function resolveFrameOrigin(fid: string): Promise<{ x: number; y: number }> {
    let origin = frameOriginCache.get(fid);
    if (!origin) {
      origin = await getFrameOrigin(boardId, fid);
      frameOriginCache.set(fid, origin);
    }
    return origin;
  }
  if ((!genOrigin || baseZIndex === undefined || hasNonExact) && !hasAnyFrameId) {
    const {objects} = await getBoardState(boardId);
    if (!genOrigin) {
      genOrigin = getOriginInEmptySpace(
        objects.filter((o: { type?: string }) => o.type !== "frame") as unknown as Array<{
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        }>
      );
    }
    if (baseZIndex === undefined) {
      const objectsWithZ = objects as Array<Record<string, unknown> & { zIndex?: number }>;
      baseZIndex =
        objectsWithZ.reduce(
          (max: number, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0),
          0
        ) + 1;
    }
    if (hasNonExact) {
      fromBoard = toRects(
        objects.filter((o: { type: string }) => o.type !== "frame") as unknown as Array<{
          x: number;
          y: number;
          width?: number;
          height?: number;
        }>
      );
    }
  }
  if (hasAnyFrameId && baseZIndex === undefined) {
    const {objects} = await getBoardState(boardId);
    const objectsWithZ = objects as Array<Record<string, unknown> & { zIndex?: number }>;
    baseZIndex =
      objectsWithZ.reduce(
        (max: number, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0),
        0
      ) + 1;
  }
  const resolvedOrigin = genOrigin ?? {x: 0, y: 0};
  const resolvedBaseZ = baseZIndex ?? 1;
  const obstacles: Array<{ x: number; y: number; width: number; height: number }> = [...fromBoard];
  const frames = await fetchFrames(boardId);
  const now = Date.now();
  const results: Array<{ objectId: string; x: number; y: number; width: number; height: number }> = [];
  const ref = objectsRef(boardId);
  let batch = getDb().batch();
  let opsInBatch = 0;

  for (let i = 0; i < textBoxes.length; i++) {
    const spec = textBoxes[i];
    const width = spec.width ?? TEXT_BOX_DEFAULT_WIDTH;
    const height = spec.height ?? TEXT_BOX_DEFAULT_HEIGHT;
    const itemFrameId = spec.frameId ?? topLevelFrameId;
    let x: number;
    let y: number;
    let outFrameId: string | undefined;
    if (itemFrameId) {
      const origin = await resolveFrameOrigin(itemFrameId);
      x = origin.x + spec.x;
      y = origin.y + spec.y;
      outFrameId = itemFrameId;
    } else {
      const exact = spec.exactPosition ?? defaultExact;
      if (exact) {
        x = resolvedOrigin.x + spec.x;
        y = resolvedOrigin.y + spec.y;
      } else {
        const placed = getNonOverlappingPosition(
          resolvedOrigin.x + spec.x,
          resolvedOrigin.y + spec.y,
          width,
          height,
          obstacles,
          20
        );
        x = placed.x;
        y = placed.y;
      }
      outFrameId = findContainingFrame(x, y, width, height, frames);
    }
    obstacles.push({x, y, width, height});

    const id = generateId();
    const zIndex = resolvedBaseZ + i;
    const obj: Record<string, unknown> = {
      id,
      type: "text",
      x,
      y,
      width,
      height,
      rotation: 0,
      text: spec.text ?? "",
      color: "transparent",
      strokeWidth: 0,
      zIndex,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    };
    if (outFrameId !== undefined) {
      obj.frameId = outFrameId;
    }
    batch.set(ref.doc(id), obj);
    opsInBatch++;
    results.push({objectId: id, x, y, width, height});

    if (opsInBatch >= FIRESTORE_BATCH_SIZE) {
      await batch.commit();
      batch = getDb().batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) {
    await batch.commit();
  }

  return {
    created: results.length,
    objectIds: results.map((r) => r.objectId),
    results,
  };
}

/**
 * Create a shape. Writes frontend-compatible doc: type 'rectangle'|'circle'|'line'.
 * If exactPosition is true, place at (x, y) without shifting; use for drawings.
 * additionalObstacles: rects from shapes created earlier in the same turn (avoids overlap).
 * genOrigin: when set (first creation in a turn), place in empty space to the right of existing content.
 */
export async function createShape(
  boardId: string,
  userId: string,
  input: {
    shapeType: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    waypoints?: Array<{x: number; y: number}>;
    exactPosition?: boolean;
    frameId?: string;
  },
  additionalObstacles?: ObstacleRect[],
  genOrigin?: GenOrigin,
  zIndex?: number
): Promise<{ objectId: string; x: number; y: number; type: string; width: number; height: number }> {
  let x: number;
  let y: number;
  let frameId: string | undefined;
  if (input.frameId) {
    const origin = await getFrameOrigin(boardId, input.frameId);
    x = origin.x + input.x;
    y = origin.y + input.y;
    frameId = input.frameId;
  } else if (input.exactPosition) {
    // Still apply genOrigin so drawings start in empty space; relative layout is preserved.
    x = genOrigin ? genOrigin.x + input.x : input.x;
    y = genOrigin ? genOrigin.y + input.y : input.y;
  } else {
    const {objects} = await getBoardState(boardId);
    const desiredX = genOrigin ? genOrigin.x + input.x : input.x;
    const desiredY = genOrigin ? genOrigin.y + input.y : input.y;
    const fromBoard = toRects(
      objects.filter((o: { type: string }) => o.type !== "frame") as unknown as Array<{
        x: number;
        y: number;
        width?: number;
        height?: number;
      }>
    );
    const obstacles = additionalObstacles?.length
      ? [...fromBoard, ...additionalObstacles]
      : fromBoard;
    const placed = getNonOverlappingPosition(
      desiredX,
      desiredY,
      input.width,
      input.height,
      obstacles,
      20
    );
    x = placed.x;
    y = placed.y;
  }
  const id = generateId();
  const now = Date.now();
  const obj: Record<string, unknown> = {
    id,
    type: input.shapeType,
    x,
    y,
    width: input.width,
    height: input.height,
    rotation: 0,
    color: input.color ?? "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 2,
    zIndex: zIndex ?? 0,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  };
  if (frameId === undefined) {
    const frames = await fetchFrames(boardId);
    frameId = findContainingFrame(x, y, input.width, input.height, frames);
  }
  if (frameId !== undefined) {
    obj.frameId = frameId;
  }
  if (input.shapeType === "circle" || input.shapeType === "star") {
    (obj as Record<string, unknown>).aspectRatio = 1;
  }
  if (input.shapeType === "triangle") {
    (obj as Record<string, unknown>).aspectRatio = input.width / input.height;
  }
  const waypoints = input.waypoints ?? [];
  if (input.shapeType === "line") {
    (obj as Record<string, unknown>).arrowType = "none";
    (obj as Record<string, unknown>).waypoints = waypoints;
  }
  if (input.shapeType === "arrow-single") {
    (obj as Record<string, unknown>).type = "line";
    (obj as Record<string, unknown>).arrowType = "single";
    (obj as Record<string, unknown>).waypoints = waypoints;
  }
  if (input.shapeType === "arrow-double") {
    (obj as Record<string, unknown>).type = "line";
    (obj as Record<string, unknown>).arrowType = "double";
    (obj as Record<string, unknown>).waypoints = waypoints;
  }
  await objectsRef(boardId).doc(id).set(obj);
  return {
    objectId: id,
    x: obj.x as number,
    y: obj.y as number,
    type: "shape",
    width: input.width,
    height: input.height,
  };
}

const BULK_CREATE_MAX = 500;
const FIRESTORE_BATCH_SIZE = 450;

type ShapeSpec = {
  shapeType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  waypoints?: Array<{ x: number; y: number }>;
  exactPosition?: boolean;
  frameId?: string;
};

/**
 * Create many shapes in one call (e.g. grids). Uses a single board-state read and
 * batched Firestore writes. Max 500 shapes per call. Pass exactPosition: true
 * (or per-shape) to place at exact (x, y) relative to genOrigin; otherwise
 * positions are adjusted to avoid overlap.
 */
export async function createShapes(
  boardId: string,
  userId: string,
  input: {
    shapes: ShapeSpec[];
    exactPosition?: boolean;
    frameId?: string;
    _genOrigin?: GenOrigin;
    _baseZIndex?: number;
  }
): Promise<{
  created: number;
  objectIds: string[];
  results: Array<{ objectId: string; x: number; y: number; width: number; height: number }>;
}> {
  const shapes = input.shapes ?? [];
  if (shapes.length === 0) {
    return {created: 0, objectIds: [], results: []};
  }
  if (shapes.length > BULK_CREATE_MAX) {
    throw new Error(`createShapes: max ${BULK_CREATE_MAX} shapes per call, got ${shapes.length}`);
  }

  const defaultExact = input.exactPosition ?? true;
  const topLevelFrameId = input.frameId;
  const hasAnyFrameId = topLevelFrameId != null || shapes.some((s) => s.frameId != null);
  const hasNonExact = shapes.some((s) => (s.exactPosition ?? defaultExact) === false);
  let genOrigin = input._genOrigin;
  let baseZIndex = input._baseZIndex;
  let fromBoard: Array<{ x: number; y: number; width: number; height: number }> = [];
  const frameOriginCache = new Map<string, { x: number; y: number }>();
  async function resolveFrameOrigin(fid: string): Promise<{ x: number; y: number }> {
    let origin = frameOriginCache.get(fid);
    if (!origin) {
      origin = await getFrameOrigin(boardId, fid);
      frameOriginCache.set(fid, origin);
    }
    return origin;
  }
  if ((!genOrigin || baseZIndex === undefined || hasNonExact) && !hasAnyFrameId) {
    const {objects} = await getBoardState(boardId);
    if (!genOrigin) {
      genOrigin = getOriginInEmptySpace(
        objects.filter((o: { type?: string }) => o.type !== "frame") as unknown as Array<{
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        }>
      );
    }
    if (baseZIndex === undefined) {
      const objectsWithZ = objects as Array<Record<string, unknown> & { zIndex?: number }>;
      baseZIndex =
        objectsWithZ.reduce(
          (max: number, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0),
          0
        ) + 1;
    }
    if (hasNonExact) {
      fromBoard = toRects(
        objects.filter((o: { type: string }) => o.type !== "frame") as unknown as Array<{
          x: number;
          y: number;
          width?: number;
          height?: number;
        }>
      );
    }
  }
  if (hasAnyFrameId && baseZIndex === undefined) {
    const {objects} = await getBoardState(boardId);
    const objectsWithZ = objects as Array<Record<string, unknown> & { zIndex?: number }>;
    baseZIndex =
      objectsWithZ.reduce(
        (max: number, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0),
        0
      ) + 1;
  }
  const resolvedOrigin = genOrigin ?? {x: 0, y: 0};
  const resolvedBaseZ = baseZIndex ?? 1;
  const obstacles: Array<{ x: number; y: number; width: number; height: number }> = [...fromBoard];
  const frames = await fetchFrames(boardId);
  const now = Date.now();
  const results: Array<{ objectId: string; x: number; y: number; width: number; height: number }> = [];
  const ref = objectsRef(boardId);
  let batch = getDb().batch();
  let opsInBatch = 0;

  for (let i = 0; i < shapes.length; i++) {
    const spec = shapes[i];
    const itemFrameId = spec.frameId ?? topLevelFrameId;
    let x: number;
    let y: number;
    let outFrameId: string | undefined;
    if (itemFrameId) {
      const origin = await resolveFrameOrigin(itemFrameId);
      x = origin.x + spec.x;
      y = origin.y + spec.y;
      outFrameId = itemFrameId;
    } else {
      const exact = spec.exactPosition ?? defaultExact;
      if (exact) {
        x = resolvedOrigin.x + spec.x;
        y = resolvedOrigin.y + spec.y;
      } else {
        const placed = getNonOverlappingPosition(
          resolvedOrigin.x + spec.x,
          resolvedOrigin.y + spec.y,
          spec.width,
          spec.height,
          obstacles,
          20
        );
        x = placed.x;
        y = placed.y;
      }
      outFrameId = findContainingFrame(x, y, spec.width, spec.height, frames);
    }
    obstacles.push({x, y, width: spec.width, height: spec.height});

    const id = generateId();
    const zIndex = resolvedBaseZ + i;
    const obj: Record<string, unknown> = {
      id,
      type: spec.shapeType,
      x,
      y,
      width: spec.width,
      height: spec.height,
      rotation: 0,
      color: spec.color ?? "#FFFFFF",
      strokeColor: "#000000",
      strokeWidth: 2,
      zIndex,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    };
    if (outFrameId !== undefined) {
      obj.frameId = outFrameId;
    }
    if (spec.shapeType === "circle" || spec.shapeType === "star") {
      obj.aspectRatio = 1;
    }
    if (spec.shapeType === "triangle") {
      obj.aspectRatio = spec.width / spec.height;
    }
    const waypoints = spec.waypoints ?? [];
    if (spec.shapeType === "line") {
      obj.arrowType = "none";
      obj.waypoints = waypoints;
    }
    if (spec.shapeType === "arrow-single") {
      obj.type = "line";
      obj.arrowType = "single";
      obj.waypoints = waypoints;
    }
    if (spec.shapeType === "arrow-double") {
      obj.type = "line";
      obj.arrowType = "double";
      obj.waypoints = waypoints;
    }
    batch.set(ref.doc(id), obj);
    opsInBatch++;
    results.push({
      objectId: id,
      x,
      y,
      width: spec.width,
      height: spec.height,
    });

    if (opsInBatch >= FIRESTORE_BATCH_SIZE) {
      await batch.commit();
      batch = getDb().batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) {
    await batch.commit();
  }

  return {
    created: results.length,
    objectIds: results.map((r) => r.objectId),
    results,
  };
}

/**
 * Create a frame. Writes frontend-compatible doc: text (title), color (hex).
 * If exactPosition is true, place at (x, y) without shifting; use for layouts/drawings.
 * additionalObstacles: rects from shapes created earlier in the same turn (avoids overlap).
 * genOrigin: when set (first creation in a turn), place in empty space to the right of existing content.
 */
export async function createFrame(
  boardId: string,
  userId: string,
  input: {
    title?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    exactPosition?: boolean;
  },
  additionalObstacles?: ObstacleRect[],
  genOrigin?: GenOrigin,
  zIndex?: number
): Promise<{ objectId: string; x: number; y: number; type: string; width: number; height: number }> {
  let x: number;
  let y: number;
  if (input.exactPosition) {
    // Still apply genOrigin so layouts start in empty space; relative positions preserved.
    x = genOrigin ? genOrigin.x + input.x : input.x;
    y = genOrigin ? genOrigin.y + input.y : input.y;
  } else {
    const {objects} = await getBoardState(boardId);
    const desiredX = genOrigin ? genOrigin.x + input.x : input.x;
    const desiredY = genOrigin ? genOrigin.y + input.y : input.y;
    const fromBoard = toRects(
      objects.filter((o: { type: string }) => o.type === "frame") as unknown as Array<{
        x: number;
        y: number;
        width?: number;
        height?: number;
      }>
    );
    const obstacles = additionalObstacles?.length
      ? [...fromBoard, ...additionalObstacles]
      : fromBoard;
    const placed = getNonOverlappingPosition(
      desiredX,
      desiredY,
      input.width,
      input.height,
      obstacles,
      20
    );
    x = placed.x;
    y = placed.y;
  }
  const id = generateId();
  const now = Date.now();
  const frameColor = input.color ?? DEFAULT_FRAME_COLOR;
  const obj = {
    id,
    type: "frame",
    text: input.title ?? "Frame",
    color: frameColor,
    x,
    y,
    width: input.width,
    height: input.height,
    rotation: 0,
    zIndex: zIndex ?? 0,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  };
  await objectsRef(boardId).doc(id).set(obj);
  return {objectId: id, x: obj.x, y: obj.y, type: "frame", width: obj.width, height: obj.height};
}

type FrameSpec = {
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  exactPosition?: boolean;
};

/**
 * Create many frames in one call (e.g. SWOT, retrospective quadrants). Max 500 per call.
 * Frames use frame-only obstacles for placement (other frames).
 */
export async function createFrames(
  boardId: string,
  userId: string,
  input: {
    frames: FrameSpec[];
    exactPosition?: boolean;
    _genOrigin?: GenOrigin;
    _baseZIndex?: number;
  }
): Promise<{
  created: number;
  objectIds: string[];
  results: Array<{ objectId: string; x: number; y: number; width: number; height: number }>;
}> {
  const frames = input.frames ?? [];
  if (frames.length === 0) {
    return {created: 0, objectIds: [], results: []};
  }
  if (frames.length > BULK_CREATE_MAX) {
    throw new Error(`createFrames: max ${BULK_CREATE_MAX} frames per call, got ${frames.length}`);
  }

  const defaultExact = input.exactPosition ?? true;
  const hasNonExact = frames.some((f) => (f.exactPosition ?? defaultExact) === false);
  let genOrigin = input._genOrigin;
  let baseZIndex = input._baseZIndex;
  let fromBoard: Array<{ x: number; y: number; width: number; height: number }> = [];
  if (!genOrigin || baseZIndex === undefined || hasNonExact) {
    const {objects} = await getBoardState(boardId);
    if (!genOrigin) {
      genOrigin = getOriginInEmptySpace(
        objects.filter((o: { type?: string }) => o.type !== "frame") as unknown as Array<{
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        }>
      );
    }
    if (baseZIndex === undefined) {
      const objectsWithZ = objects as Array<Record<string, unknown> & { zIndex?: number }>;
      baseZIndex =
        objectsWithZ.reduce(
          (max: number, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0),
          0
        ) + 1;
    }
    if (hasNonExact) {
      fromBoard = toRects(
        objects.filter((o: { type: string }) => o.type === "frame") as unknown as Array<{
          x: number;
          y: number;
          width?: number;
          height?: number;
        }>
      );
    }
  }
  const resolvedOrigin = genOrigin ?? {x: 0, y: 0};
  const resolvedBaseZ = baseZIndex ?? 1;
  const obstacles: Array<{ x: number; y: number; width: number; height: number }> = [...fromBoard];
  const now = Date.now();
  const results: Array<{ objectId: string; x: number; y: number; width: number; height: number }> = [];
  const ref = objectsRef(boardId);
  let batch = getDb().batch();
  let opsInBatch = 0;

  for (let i = 0; i < frames.length; i++) {
    const spec = frames[i];
    const exact = spec.exactPosition ?? defaultExact;
    let x: number;
    let y: number;
    if (exact) {
      x = resolvedOrigin.x + spec.x;
      y = resolvedOrigin.y + spec.y;
    } else {
      const placed = getNonOverlappingPosition(
        resolvedOrigin.x + spec.x,
        resolvedOrigin.y + spec.y,
        spec.width,
        spec.height,
        obstacles,
        20
      );
      x = placed.x;
      y = placed.y;
    }
    obstacles.push({x, y, width: spec.width, height: spec.height});

    const id = generateId();
    const zIndex = resolvedBaseZ + i;
    const frameColor = spec.color ?? DEFAULT_FRAME_COLOR;
    const obj = {
      id,
      type: "frame",
      text: spec.title ?? "Frame",
      color: frameColor,
      x,
      y,
      width: spec.width,
      height: spec.height,
      rotation: 0,
      zIndex,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    };
    batch.set(ref.doc(id), obj);
    opsInBatch++;
    results.push({objectId: id, x, y, width: spec.width, height: spec.height});

    if (opsInBatch >= FIRESTORE_BATCH_SIZE) {
      await batch.commit();
      batch = getDb().batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) {
    await batch.commit();
  }

  return {
    created: results.length,
    objectIds: results.map((r) => r.objectId),
    results,
  };
}

/**
 * Create a connector between two objects. Writes type 'line' with fromId, toId,
 * fromPoint, and toPoint so the frontend LineShape and connection logic render it
 * and keep the line attached when shapes move. Endpoints are always placed on
 * connection points: use AI-provided fromPoint/toPoint or default to "center".
 */
export async function createConnector(
  boardId: string,
  _userId: string,
  input: {
    fromId: string;
    toId: string;
    style: string;
    fromPoint?: string;
    toPoint?: string;
    waypoints?: Array<{x: number; y: number}>;
  },
  zIndex?: number
): Promise<{ objectId: string; type: string }> {
  const fromSnap = await assertObjectExists(boardId, input.fromId);
  const toSnap = await assertObjectExists(boardId, input.toId);
  const fromData = fromSnap.data() as {
    type?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
  };
  const toData = toSnap.data() as {
    type?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
  };
  const fromShape: { type: string; x: number; y: number; width?: number; height?: number; rotation?: number } = {
    type: fromData.type ?? "rectangle",
    x: fromData.x,
    y: fromData.y,
    width: fromData.width,
    height: fromData.height,
    rotation: fromData.rotation,
  };
  const toShape: { type: string; x: number; y: number; width?: number; height?: number; rotation?: number } = {
    type: toData.type ?? "rectangle",
    x: toData.x,
    y: toData.y,
    width: toData.width,
    height: toData.height,
    rotation: toData.rotation,
  };
  const fromPtId = input.fromPoint ?? "center";
  const toPtId = input.toPoint ?? "center";
  const startPt = getConnectionPointInWorld(fromShape, fromPtId) ?? getShapeCenter(fromShape);
  const endPt = getConnectionPointInWorld(toShape, toPtId) ?? getShapeCenter(toShape);
  const id = generateId();
  const now = Date.now();
  const obj: Record<string, unknown> = {
    id,
    type: "line",
    x: startPt.x,
    y: startPt.y,
    width: endPt.x - startPt.x,
    height: endPt.y - startPt.y,
    rotation: 0,
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 2,
    fromId: input.fromId,
    toId: input.toId,
    fromPoint: fromPtId,
    toPoint: toPtId,
    waypoints: input.waypoints ?? [],
    arrowType: input.style === "arrow" ? "single" : "none",
    zIndex: zIndex ?? 0,
    createdBy: _userId,
    createdAt: now,
    updatedAt: now,
    updatedBy: _userId,
  };
  if (input.style === "dashed") {
    obj.lineStyle = "dashed";
  }
  await objectsRef(boardId).doc(id).set(obj);
  return {objectId: id, type: "connector"};
}
