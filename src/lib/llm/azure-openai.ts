/**
 * Azure OpenAI gpt-4.1-mini — fallback LLM provider.
 */
import type { LLMProvider, ChatMessage, ToolDef, ChatCompletionChunk, ToolCall } from "./provider";

export class AzureOpenAIProvider implements LLMProvider {
  name = "Azure OpenAI gpt-4.1-mini";
  private endpoint: string;
  private apiKey: string;
  private deployment: string;
  private apiVersion: string;

  constructor(
    endpoint: string,
    apiKey: string,
    deployment = "gpt-4.1-mini",
    apiVersion = "2025-03-01-preview"
  ) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.deployment = deployment;
    this.apiVersion = apiVersion;
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDef[],
    onChunk?: (chunk: ChatCompletionChunk) => void
  ): Promise<ChatMessage> {
    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    const body: Record<string, any> = {
      messages,
      stream: !!onChunk,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Azure OpenAI error ${response.status}: ${err}`);
    }

    if (onChunk && response.body) {
      // Same SSE stream format as Z.AI (OpenAI-compatible)
      const reader = response.body.getReader();
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
      return { role: "assistant", content, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    return {
      role: "assistant",
      content: choice?.message?.content || "",
      tool_calls: choice?.message?.tool_calls,
    };
  }
}
