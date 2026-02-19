import Anthropic from "@anthropic-ai/sdk";
import {boardTools} from "./toolSchema.js";
import {buildSystemPrompt} from "./systemPrompt.js";
import {
  createStickyNote,
  createShape,
  createFrame,
  createConnector,
  moveObject,
  resizeObject,
  updateText,
  changeColor,
  getBoardState,
} from "./toolExecutor.js";
import {traceAgentCall, flushAll} from "./observability.js";

const anthropic = new Anthropic();

const MAX_ITERATIONS = 20;

interface AgentResult {
  success: boolean;
  toolsExecuted: string[];
  objectsCreated: string[];
  iterations: number;
}

export async function runAgent(params: {
  command: string;
  boardId: string;
  userId: string;
}): Promise<AgentResult> {
  const {command, boardId, userId} = params;

  const obs = await traceAgentCall({
    name: "board-ai-command",
    input: {command, boardId, userId},
    metadata: {boardId, userId},
  });

  const messages: Anthropic.MessageParam[] = [
    {role: "user", content: command},
  ];
  const toolsExecuted: string[] = [];
  const objectsCreated: string[] = [];

  try {
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
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
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          toolsExecuted.push(block.name);
          const span = obs.startSpan(block.name, block.input);

          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let result: any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inp = block.input as any;

            switch (block.name) {
            case "getBoardState":
              result = await getBoardState(boardId);
              break;
            case "createStickyNote":
              result = await createStickyNote(boardId, userId, inp);
              objectsCreated.push(result.objectId);
              break;
            case "createShape":
              result = await createShape(boardId, userId, inp);
              objectsCreated.push(result.objectId);
              break;
            case "createFrame":
              result = await createFrame(boardId, userId, inp);
              objectsCreated.push(result.objectId);
              break;
            case "createConnector":
              result = await createConnector(boardId, userId, inp);
              objectsCreated.push(result.objectId);
              break;
            case "moveObject":
              result = await moveObject(boardId, inp);
              break;
            case "resizeObject":
              result = await resizeObject(boardId, inp);
              break;
            case "updateText":
              result = await updateText(boardId, inp);
              break;
            case "changeColor":
              result = await changeColor(boardId, inp);
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

        // Append assistant turn + tool results to conversation
        messages.push({role: "assistant", content: response.content});
        messages.push({role: "user", content: toolResults});
      }
    }

    obs.end({
      output: {toolsExecuted, objectsCreated},
      usage: {totalIterations: iterations},
    });

    return {
      success: true,
      toolsExecuted,
      objectsCreated,
      iterations,
    };
  } catch (err) {
    obs.error(err);
    throw err;
  } finally {
    await flushAll();
  }
}
