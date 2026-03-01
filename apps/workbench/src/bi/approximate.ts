/**
 * BI-specific Approximate action — parse user intent into a chart Instance.
 *
 * Strategy: Schema as system prompt context, user query as input,
 * LLM produces a JSON payload conforming to the BI Schema.
 */

import type {
  ApproximateAction,
  Schema,
  Instance,
  Demonstration,
  ApproximateError,
  Either,
} from "@evolution/core";
import { left, right } from "@evolution/core";
import type { LLM } from "./llm";

export class BiApproximate implements ApproximateAction {
  constructor(private readonly llm: LLM) {}

  async approximate(
    schema: Schema,
    demonstration: Demonstration,
  ): Promise<Either<ApproximateError, Instance>> {
    const userQuery = extractQuery(demonstration);
    const prompt = buildPrompt(schema, userQuery);

    try {
      const raw = await this.llm(prompt);

      const payload = parseJsonFromResponse(raw);

      return right({
        schemaId: schema.id,
        schemaVersion: schema.version,
        payload,
      });
    } catch (err) {
      return left({
        kind: "approximate",
        message: err instanceof Error ? err.message : String(err),
        rawOutput: typeof err === "string" ? err : undefined,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(schema: Schema, query: string): string {
  const fieldsDescription = schema.fields
    .map((f) => {
      let typeDesc: string = f.type.kind;
      if (f.type.kind === "string" && f.type.enum) {
        typeDesc = `string, one of: ${f.type.enum.join(", ")}`;
      }
      if (f.type.kind === "array") {
        typeDesc = `array of ${f.type.element.kind}`;
      }
      if (f.type.kind === "object") {
        typeDesc = `object with fields: ${f.type.fields.map((sf) => sf.name).join(", ")}`;
      }
      const req = f.required ? "required" : "optional";
      return `  - ${f.name} (${typeDesc}, ${req}): ${f.description}`;
    })
    .join("\n");

  return `You are a BI chart configuration assistant. Given a user's natural language request, produce a JSON object that describes the desired chart.

The JSON must conform to the following schema (id: "${schema.id}", version: "${schema.version}"):

Fields:
${fieldsDescription}

Rules:
${schema.rules.map((r) => `  - ${r.kind}: ${JSON.stringify(r)}`).join("\n") || "  (none)"}

IMPORTANT:
- Output ONLY valid JSON, no markdown fences, no explanation.
- Use the exact field names from the schema.
- chartType must be one of the supported types.
- dataSource must include metrics and dimensions arrays.
- series array must have at least one entry.
- xAxis.field should reference a dimension, yAxis.field should reference a metric.

User request: ${query}`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseJsonFromResponse(raw: string): Record<string, unknown> {
  // Try to extract JSON from the response, handling markdown fences
  let text = raw.trim();

  // Remove markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("LLM response is not a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}\nRaw response: ${raw.slice(0, 500)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractQuery(demonstration: Demonstration): string {
  // For parse use case, the raw source is the user's text query
  const raw = demonstration.source.raw;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "query" in raw) {
    return String((raw as Record<string, unknown>).query);
  }
  return JSON.stringify(raw);
}
