/**
 * BI-specific Approximate action — parse user intent into a Dashboard Instance.
 *
 * Strategy: Schema as system prompt context, user query as input,
 * LLM produces a JSON DashboardPayload conforming to the BI Schema.
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
import type { BiSchema } from "./types";
import type { LLM } from "./llm";

export class BiApproximate implements ApproximateAction {
  constructor(private readonly llm: LLM) {}

  async approximate(
    schema: Schema,
    demonstration: Demonstration,
  ): Promise<Either<ApproximateError, Instance>> {
    const query = extractQuery(demonstration);
    const biSchema = schema as BiSchema;
    const prompt = buildPrompt(biSchema, query);

    try {
      const raw = await this.llm(prompt);
      const payload = parseJsonFromResponse(raw);
      return right({ schemaId: schema.id, schemaVersion: schema.version, payload });
    } catch (err) {
      return left({
        kind: "approximate",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(schema: BiSchema, query: string): string {
  const fieldsDesc = schema.fields
    .map((f) => {
      let t: string = f.type.kind;
      if (f.type.kind === "string" && f.type.enum)
        t = `string, one of: ${f.type.enum.join(", ")}`;
      if (f.type.kind === "array") t = `array of ${f.type.element.kind}`;
      if (f.type.kind === "object")
        t = `object with fields: ${f.type.fields.map((sf) => sf.name).join(", ")}`;
      return `  - ${f.name} (${t}, ${f.required ? "required" : "optional"}): ${f.description}`;
    })
    .join("\n");

  return `You are a BI dashboard configuration assistant. Given a user's natural language request, produce a JSON object that describes the desired dashboard. A dashboard contains multiple charts arranged on a grid.

The JSON must conform to the following schema (id: "${schema.id}", version: "${schema.version}"):

Fields:
${fieldsDesc || "  (none — use your best judgment for a minimal DashboardPayload)"}

Rules:
${schema.rules.map((r) => `  - ${r.kind}: ${JSON.stringify(r)}`).join("\n") || "  (none)"}

Expected top-level structure:
{
  "title": "Dashboard title",
  "layout": { "columns": 2, "rows": 2 },
  "charts": [
    {
      "id": "chart-1",
      "chartType": "bar" | "line" | "pie",
      "title": "optional chart title",
      "position": { "col": 1, "row": 1, "colSpan": 1, "rowSpan": 1 },
      "dataSource": {
        "metrics": ["revenue"],
        "dimensions": ["Jan", "Feb", "Mar"],
        "filters": [],
        "sort": null
      },
      "xAxis": { "field": "month", "label": "Month" },
      "yAxis": { "field": "revenue", "label": "Revenue" },
      "series": [{ "name": "Revenue", "field": "revenue" }]
    }
  ],
  "sharedFilters": [],
  "dataBindings": []
}

IMPORTANT:
- Output ONLY valid JSON, no markdown fences, no explanation.
- Use the exact field names from the schema.
- Place each chart on a non-overlapping grid position.
- xAxis and yAxis are omitted for pie charts.

User request: ${query}`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseJsonFromResponse(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) text = fence[1].trim();
  const parsed = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("LLM response is not a JSON object");
  return parsed as Record<string, unknown>;
}

function extractQuery(d: Demonstration): string {
  const raw = d.source.raw;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "query" in raw)
    return String((raw as Record<string, unknown>).query);
  return JSON.stringify(raw);
}
