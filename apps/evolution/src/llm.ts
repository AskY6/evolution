/**
 * Concrete LLM providers for the app layer.
 */

import type { LLM } from "@evolution/bi";

// ---------------------------------------------------------------------------
// OpenRouter provider (OpenAI-compatible API)
// ---------------------------------------------------------------------------

export interface OpenRouterConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly baseUrl?: string;
}

export function createOpenRouterLLM(config: OpenRouterConfig): LLM {
  const model = config.model ?? "anthropic/claude-sonnet-4";
  const maxTokens = config.maxTokens ?? 2048;
  const baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1";

  return async (prompt: string): Promise<string> => {
    const body = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    return content;
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
