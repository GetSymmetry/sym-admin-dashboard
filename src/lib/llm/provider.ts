/**
 * Abstract LLM provider interface.
 * Implementations: Z.AI (primary), Azure OpenAI (fallback).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ChatCompletionChunk {
  choices: {
    delta: {
      content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }[];
}

export interface LLMProvider {
  name: string;
  chat(
    messages: ChatMessage[],
    tools?: ToolDef[],
    onChunk?: (chunk: ChatCompletionChunk) => void
  ): Promise<ChatMessage>;
}
