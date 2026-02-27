/**
 * Concrete LLM providers for the app layer.
 */

import { OpenRouter } from "@openrouter/sdk";
import type { LLM } from "@evolution/bi";

// ---------------------------------------------------------------------------
// OpenRouter provider
// ---------------------------------------------------------------------------

export interface OpenRouterConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
}

export function createOpenRouterLLM(config: OpenRouterConfig): LLM {
  const client = new OpenRouter({ apiKey: config.apiKey });
  const model = config.model ?? "anthropic/claude-sonnet-4";
  const maxTokens = config.maxTokens ?? 2048;

  return async (prompt: string): Promise<string> => {
    const result = client.callModel({
      model,
      input: prompt,
      maxOutputTokens: maxTokens,
    });

    const text = await result.getText();
    if (!text) {
      throw new Error("No content in OpenRouter response");
    }
    return text;
  };
}

// ---------------------------------------------------------------------------
// Mock provider for development
// ---------------------------------------------------------------------------

export function createMockLLM(responses: string[]): LLM {
  let index = 0;
  return async (_prompt: string): Promise<string> => {
    if (index >= responses.length) {
      throw new Error("MockLLM: no more responses configured");
    }
    return responses[index++];
  };
}
