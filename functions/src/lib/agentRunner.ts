import Anthropic from "@anthropic-ai/sdk";
import {boardTools} from "./toolSchema.js";
import {buildSystemPrompt} from "./systemPrompt.js";
import {getOriginInEmptySpace} from "../tools/helpers.js";
import {
  createStickyNote,
  createStickyNotes,
  createShape,
  createShapes,
  createFrame,
  createFrames,
  createTextBox,
  createTextBoxes,
  createConnector,
  moveObject,
  moveMultipleObjects,
  resizeObject,
  resizeMultipleObjects,
  rotateObject,
  rotateMultipleObjects,
  updateText,
  changeColor,
  changeMultipleColors,
  deleteObject,
  deleteMultipleObjects,
  clearBoard,
  getBoardState,
} from "./toolExecutor.js";
import {traceAgentCall, flushAll} from "./observability.js";

const anthropic = new Anthropic();

const MAX_ITERATIONS = 40;

/** Spec requires claude-sonnet-4-6; override with AI_MODEL or ANTHROPIC_MODEL env. */
function getModel(): string {
  return (
    process.env.AI_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    "claude-sonnet-4-6"
  );
}

interface AgentResult {
  success: boolean;
  cancelled?: boolean;
  reply?: string;
  toolsExecuted: string[];
  objectsCreated: string[];
  iterations: number;
}

/** Extract concatenated text from assistant content blocks (when stop_reason is end_turn). */
function extractReplyText(content: Anthropic.MessageParam["content"]): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is {type: "text"; text: string} => block.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Conversation history from the client (previous user/assistant turns).
 * Used to seed the message list so the agent can refer to prior context.
 */
export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export async function runAgent(params: {
  command: string;
  boardId: string;
  userId: string;
  checkCancel?: () => Promise<boolean>;
  image?: { base64: string; mediaType: string };
  /** Optional prior conversation turns (user/assistant). New user message is appended after these. */
  history?: ChatHistoryTurn[];
}): Promise<AgentResult> {
  const {command, boardId, userId, checkCancel, image, history} = params;

  const obs = await traceAgentCall({
    name: "board-ai-command",
    input: {command, boardId, userId, hasImage: Boolean(image)},
    metadata: {boardId, userId},
  });

  const allowedMediaTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
  const userContent: Anthropic.MessageParam["content"] = image
    ? (() => {
      const mediaType = allowedMediaTypes.includes(image.mediaType as (typeof allowedMediaTypes)[number])
        ? (image.mediaType as (typeof allowedMediaTypes)[number])
        : "image/png";
      return [
        {type: "image" as const, source: {type: "base64" as const, media_type: mediaType, data: image.base64}},
        {type: "text" as const, text: command || "What do you see in this image? Describe it or create shapes based on it."},
      ];
    })()
    : (command || "What can I help you with?");

  // Seed with prior conversation history so the agent can refer to it (e.g. "move the sticky you just created")
  const MAX_HISTORY_TURNS = 20; // cap to avoid token overflow
  const priorTurns = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
  const messages: Anthropic.MessageParam[] = priorTurns.map((t) => ({
    role: t.role,
    content: t.content,
  }));
  messages.push({role: "user", content: userContent});
  const toolsExecuted: string[] = [];
  const objectsCreated: string[] = [];
  /** Rects of objects created this turn so subsequent creations don't overlap them. */
  const placedRectsThisTurn: Array<{ x: number; y: number; width: number; height: number }> = [];
  /** Origin for this turn's creations so they start in empty space (right of existing content). Set on first create. */
  let genOrigin: { x: number; y: number } | undefined;
  /** Base zIndex for this turn — set from board state on first creation so new shapes stack on top. */
  let baseZIndex: number | undefined;
  let reply = "";

  try {
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      if (checkCancel && (await checkCancel())) {
        return {
          success: false,
          cancelled: true,
          toolsExecuted,
          objectsCreated,
          iterations,
        };
      }
      iterations++;

      const response = await anthropic.messages.create({
        model: getModel(),
        max_tokens: 4096,
        system: buildSystemPrompt(boardId),
        tools: boardTools,
        messages,
      });

      obs.logTokens({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      if (response.stop_reason === "end_turn") {
        reply = extractReplyText(response.content);
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          if (checkCancel && (await checkCancel())) {
            return {
              success: false,
              cancelled: true,
              toolsExecuted,
              objectsCreated,
              iterations,
            };
          }

          toolsExecuted.push(block.name);
          const spanName = (block.name && String(block.name).trim()) || "tool_call";
          const span = obs.startSpan(spanName, block.input);

          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let result: any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inp = block.input as any;

            switch (block.name) {
            case "getBoardState":
              result = await getBoardState(boardId);
              break;
            case "createStickyNote": {
              if (placedRectsThisTurn.length === 0) {
                const state = await getBoardState(boardId);
                genOrigin = getOriginInEmptySpace(
                  state.objects as Array<{ x?: number; y?: number; width?: number; height?: number }>
                );
                if (baseZIndex === undefined) {
                  baseZIndex = state.objects.reduce(
                    (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                  ) + 1;
                }
              }
              const stickyZ = inp.zIndex ?? ((baseZIndex ?? 1) + placedRectsThisTurn.length);
              result = await createStickyNote(boardId, userId, inp, placedRectsThisTurn, genOrigin, stickyZ);
              objectsCreated.push(result.objectId);
              placedRectsThisTurn.push({
                x: result.x,
                y: result.y,
                width: result.width,
                height: result.height,
              });
              break;
            }
            case "createStickyNotes": {
              if (placedRectsThisTurn.length === 0) {
                const state = await getBoardState(boardId);
                genOrigin = getOriginInEmptySpace(
                  state.objects as Array<{ x?: number; y?: number; width?: number; height?: number }>
                );
                if (baseZIndex === undefined) {
                  baseZIndex = state.objects.reduce(
                    (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                  ) + 1;
                }
              }
              result = await createStickyNotes(boardId, userId, {
                ...inp,
                _genOrigin: genOrigin,
                _baseZIndex: (baseZIndex ?? 1) + placedRectsThisTurn.length,
              });
              objectsCreated.push(...result.objectIds);
              for (const r of result.results) {
                placedRectsThisTurn.push({x: r.x, y: r.y, width: r.width, height: r.height});
              }
              break;
            }
            case "createShape": {
              if (placedRectsThisTurn.length === 0) {
                const state = await getBoardState(boardId);
                genOrigin = getOriginInEmptySpace(
                  state.objects as Array<{ x?: number; y?: number; width?: number; height?: number }>
                );
                if (baseZIndex === undefined) {
                  baseZIndex = state.objects.reduce(
                    (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                  ) + 1;
                }
              }
              const shapeZ = inp.zIndex ?? ((baseZIndex ?? 1) + placedRectsThisTurn.length);
              result = await createShape(boardId, userId, inp, placedRectsThisTurn, genOrigin, shapeZ);
              objectsCreated.push(result.objectId);
              placedRectsThisTurn.push({
                x: result.x,
                y: result.y,
                width: result.width,
                height: result.height,
              });
              break;
            }
            case "createShapes": {
              if (placedRectsThisTurn.length === 0) {
                const state = await getBoardState(boardId);
                genOrigin = getOriginInEmptySpace(
                  state.objects as Array<{ x?: number; y?: number; width?: number; height?: number }>
                );
                if (baseZIndex === undefined) {
                  baseZIndex = state.objects.reduce(
                    (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                  ) + 1;
                }
              }
              result = await createShapes(boardId, userId, {
                ...inp,
                _genOrigin: genOrigin,
                _baseZIndex: (baseZIndex ?? 1) + placedRectsThisTurn.length,
              });
              objectsCreated.push(...result.objectIds);
              for (const r of result.results) {
                placedRectsThisTurn.push({x: r.x, y: r.y, width: r.width, height: r.height});
              }
              break;
            }
            case "createFrame": {
              if (placedRectsThisTurn.length === 0) {
                const state = await getBoardState(boardId);
                genOrigin = getOriginInEmptySpace(
                  state.objects as Array<{ x?: number; y?: number; width?: number; height?: number }>
                );
                if (baseZIndex === undefined) {
                  baseZIndex = state.objects.reduce(
                    (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                  ) + 1;
                }
              }
              const frameZ = inp.zIndex ?? 0;
              result = await createFrame(boardId, userId, inp, placedRectsThisTurn, genOrigin, frameZ);
              objectsCreated.push(result.objectId);
              placedRectsThisTurn.push({
                x: result.x,
                y: result.y,
                width: result.width,
                height: result.height,
              });
              break;
            }
            case "createFrames": {
              if (placedRectsThisTurn.length === 0) {
                const state = await getBoardState(boardId);
                genOrigin = getOriginInEmptySpace(
                  state.objects as Array<{ x?: number; y?: number; width?: number; height?: number }>
                );
                if (baseZIndex === undefined) {
                  baseZIndex = state.objects.reduce(
                    (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                  ) + 1;
                }
              }
              result = await createFrames(boardId, userId, {
                ...inp,
                _genOrigin: genOrigin,
                _baseZIndex: 0,
              });
              objectsCreated.push(...result.objectIds);
              for (const r of result.results) {
                placedRectsThisTurn.push({x: r.x, y: r.y, width: r.width, height: r.height});
              }
              break;
            }
            case "createTextBox": {
              if (placedRectsThisTurn.length === 0) {
                const state = await getBoardState(boardId);
                genOrigin = getOriginInEmptySpace(
                  state.objects as Array<{ x?: number; y?: number; width?: number; height?: number }>
                );
                if (baseZIndex === undefined) {
                  baseZIndex = state.objects.reduce(
                    (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                  ) + 1;
                }
              }
              const textBoxZ = inp.zIndex ?? ((baseZIndex ?? 1) + placedRectsThisTurn.length);
              result = await createTextBox(boardId, userId, inp, placedRectsThisTurn, genOrigin, textBoxZ);
              objectsCreated.push(result.objectId);
              placedRectsThisTurn.push({
                x: result.x,
                y: result.y,
                width: result.width,
                height: result.height,
              });
              break;
            }
            case "createTextBoxes": {
              if (placedRectsThisTurn.length === 0) {
                const state = await getBoardState(boardId);
                genOrigin = getOriginInEmptySpace(
                  state.objects as Array<{ x?: number; y?: number; width?: number; height?: number }>
                );
                if (baseZIndex === undefined) {
                  baseZIndex = state.objects.reduce(
                    (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                  ) + 1;
                }
              }
              result = await createTextBoxes(boardId, userId, {
                ...inp,
                _genOrigin: genOrigin,
                _baseZIndex: (baseZIndex ?? 1) + placedRectsThisTurn.length,
              });
              objectsCreated.push(...result.objectIds);
              for (const r of result.results) {
                placedRectsThisTurn.push({x: r.x, y: r.y, width: r.width, height: r.height});
              }
              break;
            }
            case "createConnector": {
              if (baseZIndex === undefined) {
                const state = await getBoardState(boardId);
                baseZIndex = state.objects.reduce(
                  (max, o) => Math.max(max, typeof o.zIndex === "number" ? o.zIndex : 0), 0
                ) + 1;
              }
              const connZ = (baseZIndex ?? 1) + placedRectsThisTurn.length;
              result = await createConnector(boardId, userId, inp, connZ);
              objectsCreated.push(result.objectId);
              break;
            }
            case "moveObject":
              result = await moveObject(boardId, inp, userId);
              break;
            case "moveMultipleObjects":
              result = await moveMultipleObjects(boardId, inp, userId);
              break;
            case "resizeObject":
              result = await resizeObject(boardId, inp, userId);
              break;
            case "resizeMultipleObjects":
              result = await resizeMultipleObjects(boardId, inp, userId);
              break;
            case "rotateObject":
              result = await rotateObject(boardId, inp, userId);
              break;
            case "rotateMultipleObjects":
              result = await rotateMultipleObjects(boardId, inp, userId);
              break;
            case "updateText":
              result = await updateText(boardId, inp, userId);
              break;
            case "changeColor":
              result = await changeColor(boardId, inp, userId);
              break;
            case "changeMultipleColors":
              result = await changeMultipleColors(boardId, inp, userId);
              break;
            case "deleteObject":
              result = await deleteObject(boardId, inp, userId);
              break;
            case "deleteMultipleObjects":
              result = await deleteMultipleObjects(boardId, inp, userId);
              break;
            case "clearBoard":
              result = await clearBoard(boardId, inp, userId);
              break;
            default:
              throw new Error(`Unknown tool: ${block.name}`);
            }

            span.end({result});
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            span.error(err);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Error: ${err instanceof Error ? err.message : String(err)}`,
              is_error: true,
            });
          }
        }

        if (checkCancel && (await checkCancel())) {
          return {
            success: false,
            cancelled: true,
            toolsExecuted,
            objectsCreated,
            iterations,
          };
        }

        // Append assistant turn + tool results to conversation
        messages.push({role: "assistant", content: response.content});
        messages.push({role: "user", content: toolResults});
      }
    }

    obs.end({
      output: {toolsExecuted, objectsCreated, reply},
      usage: {totalIterations: iterations},
    });

    return {
      success: true,
      reply: reply || undefined,
      toolsExecuted,
      objectsCreated,
      iterations,
    };
  } catch (err) {
    obs.error(err);
    throw err;
  } finally {
    // Flush Langfuse in background so response latency isn't tied to their ingestion.
    void flushAll().catch(() => { /* non-blocking */ });
  }
}
