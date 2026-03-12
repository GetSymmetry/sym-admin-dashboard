/**
 * Fetches tool definitions from the debugger service and converts to
 * OpenAI function calling format. Executes tool calls by calling
 * debugger endpoints directly.
 */
import { debuggerClient } from "@/lib/api/client";
import type { ToolDefinition } from "@/lib/api/types";
import type { ToolDef, ChatMessage } from "./provider";

let cachedTools: ToolDef[] | null = null;

export async function fetchToolDefinitions(): Promise<ToolDef[]> {
  if (cachedTools) return cachedTools;

  const response = await debuggerClient.get<{ tools: ToolDefinition[]; count: number }>(
    "/debug/tools/schema"
  );
  const tools = response.data.tools;

  cachedTools = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          t.parameters.map((p) => [
            p.name,
            {
              type: p.type === "int" ? "integer" : p.type === "str" ? "string" : p.type,
              description: p.description,
            },
          ])
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));

  return cachedTools;
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  allTools: ToolDefinition[]
): Promise<string> {
  const tool = allTools.find((t) => t.name === toolName);
  if (!tool) return JSON.stringify({ error: `Unknown tool: ${toolName}` });

  try {
    let result;
    if (tool.method === "POST") {
      result = await debuggerClient.post(tool.path, args);
    } else {
      const params: Record<string, string> = {};
      let path = tool.path;
      for (const [key, value] of Object.entries(args)) {
        if (path.includes(`{${key}}`)) {
          path = path.replace(`{${key}}`, String(value));
        } else {
          params[key] = String(value);
        }
      }
      result = await debuggerClient.get(path, Object.keys(params).length > 0 ? params : undefined);
    }
    return JSON.stringify(result.data);
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

export function buildToolResultMessage(toolCallId: string, result: string): ChatMessage {
  return {
    role: "tool",
    content: result,
    tool_call_id: toolCallId,
  };
}
