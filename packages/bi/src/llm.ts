/**
 * LLM type — a simple function from prompt to response.
 *
 * Concrete providers (OpenRouter, mock, etc.) live in the app layer.
 * The BI package only depends on this minimal contract.
 */
export type LLM = (prompt: string) => Promise<string>;
