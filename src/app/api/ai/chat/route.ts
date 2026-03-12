import { NextRequest } from "next/server";
import { ZAIProvider } from "@/lib/llm/zai";
import { AzureOpenAIProvider } from "@/lib/llm/azure-openai";
import type { LLMProvider, ChatMessage, ToolDef } from "@/lib/llm/provider";

const SYSTEM_PROMPT = `You are a Symmetry infrastructure debugger assistant. You have access to tools that query PostgreSQL, Neo4j, App Insights, Service Bus, Azure Storage, Container Apps, and Cost Management.

When users ask questions about the system, use the available tools to fetch real data before answering. Always cite the data source and provide specific numbers.

Available capabilities:
- Query user, workspace, and organization data
- Check processing job status and pipeline health
- Inspect error clusters and traces
- Monitor container apps, database performance, and costs
- Execute ad-hoc SQL and Cypher queries (read-only)

Respond concisely with data-driven insights.`;

function getProvider(): LLMProvider {
  // Prefer Z.AI, fallback to Azure OpenAI
  const zaiKey = process.env.ZAI_API_KEY;
  if (zaiKey) {
    return new ZAIProvider(zaiKey);
  }

  const aoaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const aoaiKey = process.env.AZURE_OPENAI_API_KEY;
  if (aoaiEndpoint && aoaiKey) {
    return new AzureOpenAIProvider(
      aoaiEndpoint,
      aoaiKey,
      process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1-mini"
    );
  }

  throw new Error("No LLM provider configured. Set ZAI_API_KEY or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY.");
}

// Cache tool schema to avoid re-fetching on every request
let cachedTools: { tools: ToolDef[]; schema: any; fetchedAt: number } | null = null;
const SCHEMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getToolSchema(debuggerUrl: string): Promise<{ tools: ToolDef[]; schema: any }> {
  if (cachedTools && Date.now() - cachedTools.fetchedAt < SCHEMA_CACHE_TTL) {
    return { tools: cachedTools.tools, schema: cachedTools.schema };
  }
  try {
    const schemaRes = await fetch(`${debuggerUrl}/debug/tools/schema`);
    if (schemaRes.ok) {
      const schema = await schemaRes.json();
      const tools: ToolDef[] = schema.tools.map((t: any) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: "object",
            properties: Object.fromEntries(
              t.parameters.map((p: any) => [p.name, { type: p.type === "int" ? "integer" : "string", description: p.description }])
            ),
            required: t.parameters.filter((p: any) => p.required).map((p: any) => p.name),
          },
        },
      }));
      cachedTools = { tools, schema, fetchedAt: Date.now() };
      return { tools, schema };
    }
  } catch {}
  return { tools: [], schema: { tools: [] } };
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json();
  const provider = getProvider();

  const debuggerUrl = (process.env.NEXT_PUBLIC_DEBUGGER_URL || "http://localhost:8004/api").trim();
  const { tools, schema: toolSchema } = await getToolSchema(debuggerUrl);

  // Build conversation with system prompt
  const fullMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  // Stream response using SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        // Tool execution loop (max 5 iterations)
        let currentMessages = [...fullMessages];
        for (let i = 0; i < 5; i++) {
          const response = await provider.chat(currentMessages, tools, (chunk) => {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) send(JSON.stringify({ type: "content", content }));
          });

          if (!response.tool_calls || response.tool_calls.length === 0) {
            // No more tool calls, we're done
            if (response.content && i > 0) {
              // If we had tool calls before but content wasn't streamed
              send(JSON.stringify({ type: "content", content: response.content }));
            }
            break;
          }

          // Execute tool calls
          currentMessages.push(response);
          for (const tc of response.tool_calls) {
            send(JSON.stringify({ type: "tool_call", name: tc.function.name }));
            try {
              const args = JSON.parse(tc.function.arguments);
              // Find the tool definition to get its path
              const toolDef = tools.find(t => t.function.name === tc.function.name);
              if (!toolDef) throw new Error(`Unknown tool: ${tc.function.name}`);

              // Execute against debugger service using cached schema
              const tool = toolSchema.tools.find((t: any) => t.name === tc.function.name);
              let result;
              if (tool?.method === "POST") {
                result = await (await fetch(`${debuggerUrl}${tool.path}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(args),
                })).json();
              } else if (tool) {
                let path = tool.path;
                const queryParams: string[] = [];
                for (const [key, value] of Object.entries(args)) {
                  if (path.includes(`{${key}}`)) path = path.replace(`{${key}}`, String(value));
                  else queryParams.push(`${key}=${encodeURIComponent(String(value))}`);
                }
                const url = `${debuggerUrl}${path}${queryParams.length ? "?" + queryParams.join("&") : ""}`;
                result = await (await fetch(url)).json();
              }

              currentMessages.push({
                role: "tool",
                content: JSON.stringify(result?.data || result),
                tool_call_id: tc.id,
              });
              send(JSON.stringify({ type: "tool_result", name: tc.function.name }));
            } catch (err: any) {
              currentMessages.push({
                role: "tool",
                content: JSON.stringify({ error: err.message }),
                tool_call_id: tc.id,
              });
            }
          }
        }

        send("[DONE]");
      } catch (err: any) {
        send(JSON.stringify({ type: "error", content: err.message }));
        send("[DONE]");
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
