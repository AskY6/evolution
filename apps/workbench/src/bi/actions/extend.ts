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
import type { BiSchema, BiExtension } from "../core/schema";
import type { LLM } from "../llm";

export class BiExtend implements ExtendAction {
  constructor(private readonly llm: LLM) {}

  async extend(
    schema: Schema,
    gap: Gap,
    demonstration: Demonstration,
    existingExtensions: ReadonlyArray<Extension>,
  ): Promise<Either<ExtendError, ExtendResult>> {
    const biSchema = schema as BiSchema;
    const biExts = existingExtensions as ReadonlyArray<BiExtension>;
    const prompt = buildExtendPrompt(biSchema, gap, demonstration, biExts);

    try {
      const raw = await this.llm(prompt);
      const parsed = parseJsonFromResponse(raw);
      const extension = parseExtension(parsed);
      const candidateInstance: CandidateInstance = {
        schemaId: schema.id,
        schemaVersion: schema.version,
        basePayload: (parsed.basePayload as Record<string, unknown>) ?? {},
        extensionPayload: (parsed.extensionPayload as Record<string, unknown>) ?? {},
      };
      return right({ extension, candidateInstance });
    } catch (err) {
      return left({
        kind: "extend",
        message: err instanceof Error ? err.message : String(err),
        iteration: existingExtensions.length + 1,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildExtendPrompt(
  schema: BiSchema,
  gap: Gap,
  demonstration: Demonstration,
  existingExtensions: ReadonlyArray<BiExtension>,
): string {
  const schemaJson = JSON.stringify(
    { id: schema.id, version: schema.version, fields: schema.fields, rules: schema.rules },
    null,
    2,
  );

  const discrepancies = gap.discrepancies
    .map(
      (d) =>
        `  - ${d.path}: ${d.type} (expected: ${JSON.stringify(d.expected)}, actual: ${JSON.stringify(d.actual)})`,
    )
    .join("\n");

  const existingExts =
    existingExtensions.length > 0
      ? `\nAlready tried extensions (do NOT repeat):\n${existingExtensions.map((e) => `  - ${e.id}: ${e.description}`).join("\n")}`
      : "";

  const sourceInfo =
    typeof demonstration.source.raw === "string"
      ? demonstration.source.raw
      : JSON.stringify(demonstration.source.raw);

  return `You are a BI Dashboard Schema extension assistant. The current schema cannot fully express an expert's demonstrated dashboard. Propose a minimal schema extension to bridge the gap.

Current Schema:
${schemaJson}

Gap (severity: ${gap.severity}, source: ${gap.source}):
${discrepancies}
Summary: ${gap.summary}
${existingExts}

Expert demonstration source:
${sourceInfo}

Respond with a single JSON object containing:
1. "extension": { "id": string, "description": string, "newFields": [...], "newRules": [...] }
2. "basePayload": portion of the DashboardPayload expressible under current schema
3. "extensionPayload": portion requiring new extension fields

IMPORTANT:
- Output ONLY valid JSON, no markdown fences, no explanation.
- Extensions only ADD fields/rules — never remove or modify existing ones.
- Keep extensions minimal — add only what's needed to bridge the gap.
- Both basePayload and extensionPayload should be flat objects (not nested DashboardPayloads).`;
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

function parseExtension(parsed: Record<string, unknown>): BiExtension {
  const ext = parsed.extension as Record<string, unknown> | undefined;
  if (!ext || typeof ext !== "object")
    throw new Error("Response missing 'extension' object");
  return {
    id: String(ext.id ?? `ext-${Date.now()}`),
    description: String(ext.description ?? ""),
    newFields: (Array.isArray(ext.newFields) ? ext.newFields : []).map(
      (f: Record<string, unknown>) => ({
        name: String(f.name ?? "unknown"),
        description: String(f.description ?? ""),
        type: (f.type ?? { kind: "string" }) as BiExtension["newFields"][number]["type"],
        required: Boolean(f.required ?? false),
      }),
    ),
    newRules: Array.isArray(ext.newRules) ? ext.newRules : [],
  };
}
