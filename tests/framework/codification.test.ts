import { describe, it, expect } from "vitest";
import { runCodification } from "../../packages/evolution/src/pipelines/codification.js";
import type { CodificationInput } from "../../packages/evolution/src/pipelines/codification.js";
import type { Schema, CandidateSchema } from "../../packages/evolution/src/types/schema.js";
import type { Memory } from "../../packages/evolution/src/types/memory.js";
import { EvolutionOutcome } from "../../packages/evolution/src/types/memory.js";
import { Severity, GapSource, DiscrepancyType } from "../../packages/evolution/src/types/gap.js";
import type { Gap } from "../../packages/evolution/src/types/gap.js";
import { isLeft, isRight } from "../../packages/evolution/src/adapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const schema: Schema = {
  id: "test",
  version: "0.1.0",
  fields: [
    { name: "type", description: "Type", type: { kind: "string" }, required: true },
  ],
  rules: [],
};

const memory: Memory = {
  currentSchema: schema,
  schemaHistory: [schema],
  records: [],
};

const gap: Gap = {
  source: GapSource.Behavioral,
  discrepancies: [{ path: "extra", type: DiscrepancyType.Missing, expected: "value", actual: undefined }],
  severity: Severity.Major,
  summary: "Missing extra field",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runCodification", () => {
  it("promotes CandidateSchema into Memory with minor version bump", () => {
    const candidateSchema: CandidateSchema = {
      baseSchema: schema,
      extensions: [{
        id: "add-extra",
        description: "Add extra field",
        newFields: [{ name: "extra", description: "Extra field", type: { kind: "string" }, required: false }],
        newRules: [],
      }],
    };

    const result = runCodification({
      memory,
      candidateSchema,
      candidateInstance: {
        schemaId: "test",
        schemaVersion: "0.1.0",
        basePayload: { type: "a" },
        extensionPayload: { extra: "val" },
      },
      demonstrationId: "demo-1",
      gap,
      iterations: 2,
    });

    expect(isRight(result)).toBe(true);
    if (isLeft(result)) return;

    const newMemory = result.right;
    expect(newMemory.currentSchema.version).toBe("0.2.0");
    expect(newMemory.currentSchema.fields).toHaveLength(2);
    expect(newMemory.currentSchema.fields[1].name).toBe("extra");
    expect(newMemory.schemaHistory).toHaveLength(2);
    expect(newMemory.records).toHaveLength(1);
    expect(newMemory.records[0].outcome).toBe(EvolutionOutcome.Success);
    expect(newMemory.records[0].fromSchemaVersion).toBe("0.1.0");
    expect(newMemory.records[0].toSchemaVersion).toBe("0.2.0");
    expect(newMemory.records[0].iterations).toBe(2);
  });

  it("preserves existing schema history and records", () => {
    const memoryWithHistory: Memory = {
      currentSchema: schema,
      schemaHistory: [
        { id: "test", version: "0.0.0", fields: [], rules: [] },
        schema,
      ],
      records: [{
        id: "prev",
        timestamp: "2026-01-01T00:00:00Z",
        demonstrationId: "old-demo",
        outcome: EvolutionOutcome.Success,
        fromSchemaVersion: "0.0.0",
        toSchemaVersion: "0.1.0",
      }],
    };

    const result = runCodification({
      memory: memoryWithHistory,
      candidateSchema: { baseSchema: schema, extensions: [] },
      candidateInstance: {
        schemaId: "test",
        schemaVersion: "0.1.0",
        basePayload: { type: "a" },
        extensionPayload: {},
      },
      demonstrationId: "demo-2",
      gap,
      iterations: 1,
    });

    expect(isRight(result)).toBe(true);
    if (isLeft(result)) return;

    const newMemory = result.right;
    expect(newMemory.schemaHistory).toHaveLength(3);
    expect(newMemory.records).toHaveLength(2);
  });

  it("bumps version correctly for multi-digit versions", () => {
    const v2Schema: Schema = { ...schema, version: "1.9.3" };
    const v2Memory: Memory = {
      currentSchema: v2Schema,
      schemaHistory: [v2Schema],
      records: [],
    };

    const result = runCodification({
      memory: v2Memory,
      candidateSchema: { baseSchema: v2Schema, extensions: [] },
      candidateInstance: {
        schemaId: "test",
        schemaVersion: "1.9.3",
        basePayload: { type: "a" },
        extensionPayload: {},
      },
      demonstrationId: "demo-3",
      gap,
      iterations: 1,
    });

    expect(isRight(result)).toBe(true);
    if (isLeft(result)) return;

    expect(result.right.currentSchema.version).toBe("1.10.0");
  });
});
