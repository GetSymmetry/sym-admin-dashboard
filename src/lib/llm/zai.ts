/**
 * Z.AI GLM-4.7 Flash — primary LLM provider.
 * Uses OpenAI-compatible chat completions API.
 */
import type { LLMProvider, ChatMessage, ToolDef, ChatCompletionChunk, ToolCall } from "./provider";

export class ZAIProvider implements LLMProvider {
  name = "Z.AI GLM-4.7 Flash";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl = "https://open.z.ai/api/paas/v4", model = "glm-4.7-flash") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDef[],
    onChunk?: (chunk: ChatCompletionChunk) => void
  ): Promise<ChatMessage> {
    const body: Record<string, any> = {
      model: this.model,
      messages,
      stream: !!onChunk,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Z.AI API error ${response.status}: ${err}`);
    }

    if (onChunk && response.body) {
      return this.handleStream(response.body, onChunk);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    return {
      role: "assistant",
      content: choice?.message?.content || "",
      tool_calls: choice?.message?.tool_calls,
    };
  }

  private async handleStream(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: ChatCompletionChunk) => void
  ): Promise<ChatMessage> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let content = "";
    let toolCalls: ToolCall[] = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const chunk: ChatCompletionChunk = JSON.parse(data);
          onChunk(chunk);

          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) content += delta.content;
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) toolCalls.push(tc);
              else if (toolCalls.length > 0 && tc.function?.arguments) {
                toolCalls[toolCalls.length - 1].function.arguments += tc.function.arguments;
              }
            }
          }
        } catch {}
      }
    }

    return {
      role: "assistant",
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
