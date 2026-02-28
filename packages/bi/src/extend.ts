/**
 * BI-specific Extend action — propose Schema extensions for BI charts.
 *
 * Strategy: Include current Schema, Gap discrepancies, demonstration source,
 * and existing extensions in the prompt. LLM proposes new fields/rules and
 * splits the data into base + extension payloads.
 */

import type {
  ExtendAction,
  ExtendResult,
  Schema,
  Extension,
  CandidateInstance,
  Demonstration,
  Gap,
  ExtendError,
  Either,
} from "@evolution/core";
import { left, right } from "@evolution/core";
import type { LLM } from "./llm.js";

export class BiExtend implements ExtendAction {
  constructor(private readonly llm: LLM) {}

  async extend(
    schema: Schema,
    gap: Gap,
    demonstration: Demonstration,
    existingExtensions: ReadonlyArray<Extension>,
  ): Promise<Either<ExtendError, ExtendResult>> {
    const prompt = buildExtendPrompt(schema, gap, demonstration, existingExtensions);

    try {
      const raw = await this.llm(prompt);
      const parsed = parseJsonFromResponse(raw);

      const extension = parseExtension(parsed);
      const candidateInstance = parseCandidateInstance(parsed, schema);

      return right({ extension, candidateInstance });
    } catch (err) {
      return left({
        kind: "extend",
        message: err instanceof Error ? err.message : String(err),
        iteration: existingExtensions.length + 1,
        rawOutput: typeof err === "string" ? err : undefined,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildExtendPrompt(
  schema: Schema,
  gap: Gap,
  demonstration: Demonstration,
  existingExtensions: ReadonlyArray<Extension>,
): string {
  const schemaJson = JSON.stringify(
    { id: schema.id, version: schema.version, fields: schema.fields, rules: schema.rules },
    null,
    2,
  );

  const discrepancies = gap.discrepancies
    .map((d) => `  - ${d.path}: ${d.type} (expected: ${JSON.stringify(d.expected)}, actual: ${JSON.stringify(d.actual)})`)
    .join("\n");

  const existingExts = existingExtensions.length > 0
    ? `\nAlready tried extensions (do NOT repeat these, try a different approach):\n${existingExtensions.map((e) => `  - ${e.id}: ${e.description} (fields: ${e.newFields.map((f) => f.name).join(", ")})`).join("\n")}`
    : "";

  const sourceInfo = typeof demonstration.source.raw === "string"
    ? demonstration.source.raw
    : JSON.stringify(demonstration.source.raw);

  return `You are a BI Schema extension assistant. The current schema cannot fully express an expert's demonstrated behavior. Propose a minimal schema extension to bridge the gap.

Current Schema:
${schemaJson}

Gap (what's missing — severity: ${gap.severity}, source: ${gap.source}):
${discrepancies}
Summary: ${gap.summary}
${existingExts}

Expert demonstration source:
${sourceInfo}

Respond with a single JSON object containing:
1. "extension": An object with:
   - "id": A short kebab-case identifier for the extension (e.g., "add-pie-chart")
   - "description": What this extension adds
   - "newFields": Array of new field definitions to add to the schema. Each field has:
     - "name": string, "description": string, "type": { "kind": "string"|"number"|"boolean"|"object"|"array", ... }, "required": boolean
   - "newRules": Array of new rules (can be empty [])
2. "basePayload": The portion of the instance data expressible under the current schema
3. "extensionPayload": The portion requiring the new extension fields

IMPORTANT:
- Output ONLY valid JSON, no markdown fences, no explanation.
- Extensions only ADD fields/rules — never remove or modify existing ones.
- Keep extensions minimal — add only what's needed to bridge the gap.
- basePayload must conform to the current schema fields.
- extensionPayload must use ONLY the new field names from your extension.`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseJsonFromResponse(raw: string): Record<string, unknown> {
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

function parseExtension(parsed: Record<string, unknown>): Extension {
  const ext = parsed.extension;
  if (typeof ext !== "object" || ext === null || Array.isArray(ext)) {
    throw new Error("Response missing valid 'extension' object");
  }

  const extObj = ext as Record<string, unknown>;

  const id = typeof extObj.id === "string" ? extObj.id : `ext-${Date.now()}`;
  const description = typeof extObj.description === "string" ? extObj.description : "LLM-proposed extension";
  const newFields = Array.isArray(extObj.newFields) ? extObj.newFields : [];
  const newRules = Array.isArray(extObj.newRules) ? extObj.newRules : [];

  return {
    id,
    description,
    newFields: newFields.map(normalizeField),
    newRules: newRules as Extension["newRules"],
  };
}

function normalizeField(raw: unknown): Extension["newFields"][number] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid field definition in extension");
  }
  const field = raw as Record<string, unknown>;
  return {
    name: String(field.name ?? "unknown"),
    description: String(field.description ?? ""),
    type: (field.type ?? { kind: "string" }) as Extension["newFields"][number]["type"],
    required: Boolean(field.required ?? false),
  };
}

function parseCandidateInstance(
  parsed: Record<string, unknown>,
  schema: Schema,
): CandidateInstance {
  const basePayload =
    typeof parsed.basePayload === "object" && parsed.basePayload !== null
      ? (parsed.basePayload as Record<string, unknown>)
      : {};

  const extensionPayload =
    typeof parsed.extensionPayload === "object" && parsed.extensionPayload !== null
      ? (parsed.extensionPayload as Record<string, unknown>)
      : {};

  return {
    schemaId: schema.id,
    schemaVersion: schema.version,
    basePayload,
    extensionPayload,
  };
}
