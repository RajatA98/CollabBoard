import {objectsRef} from "./helpers.js";

/**
 * Returns all objects and counts per spec. Used by the agent before
 * any manipulation/layout command and by creation tools for placement.
 */
export async function getBoardState(boardId: string): Promise<{
  objects: Array<Record<string, unknown> & { id: string; type: string }>;
  counts: { total: number; stickies: number; shapes: number; frames: number; connectors: number };
}> {
  const snapshot = await objectsRef(boardId).get();
  const objects = snapshot.empty
    ? []
    : snapshot.docs.map((d) => ({...d.data(), id: d.id} as Record<string, unknown> & { id: string; type: string }));
  let stickies = 0;
  let shapes = 0;
  let frames = 0;
  let connectors = 0;
  for (const obj of objects) {
    if (obj.type === "sticky") stickies++;
    else if (obj.type === "frame") frames++;
    else if (
      obj.type === "rectangle" ||
      obj.type === "circle" ||
      obj.type === "line" ||
      obj.type === "triangle" ||
      obj.type === "star"
    ) {
      shapes++;
    }
    if (
      obj.type === "line" &&
      "fromId" in obj &&
      obj.fromId &&
      "toId" in obj &&
      obj.toId
    ) {
      connectors++;
    }
  }
  return {
    objects,
    counts: {
      total: objects.length,
      stickies,
      shapes,
      frames,
      connectors,
    },
  };
}
