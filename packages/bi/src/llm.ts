/**
 * LLM provider abstraction for BI approximate/extend actions.
 *
 * The framework is LLM-agnostic. This module defines a simple provider
 * interface and ships two implementations:
 * - AnthropicProvider: real Claude API calls via fetch
 * - MockLLMProvider: deterministic responses for testing
 */

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface Message {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LLMProvider {
  generate(messages: ReadonlyArray<Message>): Promise<string>;
}

// ---------------------------------------------------------------------------
// Anthropic Claude provider
// ---------------------------------------------------------------------------

export interface AnthropicConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly maxTokens?: number;
}

export class AnthropicProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "claude-sonnet-4-20250514";
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async generate(messages: ReadonlyArray<Message>): Promise<string> {
    // Separate system message from conversation messages
    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: conversationMessages,
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const textBlock = data.content.find((b) => b.type === "text");
    if (!textBlock?.text) {
      throw new Error("No text content in Anthropic response");
    }

    return textBlock.text;
  }
}

// ---------------------------------------------------------------------------
// Mock provider for testing
// ---------------------------------------------------------------------------

/**
 * Mock LLM provider that returns pre-configured responses.
 * Used in tests and offline development.
 */
export class MockLLMProvider implements LLMProvider {
  private responses: string[];
  private callIndex = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async generate(_messages: ReadonlyArray<Message>): Promise<string> {
    if (this.callIndex >= this.responses.length) {
      throw new Error("MockLLMProvider: no more responses configured");
    }
    return this.responses[this.callIndex++];
  }
}
