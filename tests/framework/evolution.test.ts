import { describe, it, expect } from "vitest";
import { runEvolution } from "../../packages/evolution/src/pipelines/evolution.js";
import type { EvolutionInput } from "../../packages/evolution/src/pipelines/evolution.js";
import type { Schema } from "../../packages/evolution/src/types/schema.js";
import type { Instance, CandidateInstance } from "../../packages/evolution/src/types/instance.js";
import type { Behavior, Demonstration } from "../../packages/evolution/src/types/demonstration.js";
import type { Memory } from "../../packages/evolution/src/types/memory.js";
import type { DomainAdapter } from "../../packages/evolution/src/adapter.js";
import type { ApproximateAction } from "../../packages/evolution/src/actions/approximate.js";
import type { ExtendAction, ExtendResult } from "../../packages/evolution/src/actions/extend.js";
import type { Either } from "../../packages/evolution/src/adapter.js";
import type { ApproximateError, ExtendError } from "../../packages/evolution/src/types/errors.js";
import type { Executable } from "../../packages/evolution/src/types/compile.js";
import type { RuntimeCapability } from "../../packages/evolution/src/types/runtime.js";
import type { ConvergenceConfig } from "../../packages/evolution/src/types/pipeline.js";
import { Stage } from "../../packages/evolution/src/types/pipeline.js";
import { left, right } from "../../packages/evolution/src/adapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const schema: Schema = {
  id: "test",
  version: "1.0.0",
  fields: [
    { name: "type", description: "Type", type: { kind: "string", enum: ["a", "b"] }, required: true },
    { name: "value", description: "Value", type: { kind: "number" }, required: true },
  ],
  rules: [],
};

const memory: Memory = {
  currentSchema: schema,
  schemaHistory: [schema],
  records: [],
};

const convergenceConfig: ConvergenceConfig = {
  maxIterations: 5,
  gapThreshold: 2,
};

function makeBehavior(fingerprint: Record<string, unknown>): Behavior {
  return { fingerprint };
}

function makeInstance(payload: Record<string, unknown>): Instance {
  return { schemaId: "test", schemaVersion: "1.0.0", payload };
}

function makeDemo(expected: Behavior): Demonstration {
  return {
    id: "demo-1",
    timestamp: "2026-01-01T00:00:00Z",
    source: { type: "test", raw: "test input" },
    observedBehavior: expected,
  };
}

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

function mockAdapter(overrides?: {
  compile?: DomainAdapter["compile"];
  compileC?: DomainAdapter["compileC"];
  execute?: DomainAdapter["execute"];
}): DomainAdapter {
  return {
    compile: overrides?.compile ?? ((instance: Instance) =>
      right({ format: "test", artifact: instance.payload })),
    compileC: overrides?.compileC ?? (() => ({
      kind: "compiled" as const,
      executable: { format: "test", artifact: { type: "a", value: 42 } },
    })),
    execute: overrides?.execute ?? ((executable: Executable) =>
      right(makeBehavior(executable.artifact as Record<string, unknown>))),
    fingerprint: (raw: unknown) => makeBehavior(raw as Record<string, unknown>),
    runtime: (): RuntimeCapability => ({ features: [] }),
  };
}

// ---------------------------------------------------------------------------
// Mock actions
// ---------------------------------------------------------------------------

function mockApproximate(
  result: Either<ApproximateError, Instance>,
): ApproximateAction {
  return { approximate: async () => result };
}

function mockExtendAction(
  result: Either<ExtendError, ExtendResult>,
): ExtendAction {
  return { extend: async () => result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runEvolution", () => {
  it("returns Assimilated when schema is sufficient (behaviors match)", async () => {
    const behavior = makeBehavior({ type: "a", value: 42 });
    const instance = makeInstance({ type: "a", value: 42 });
    const demo = makeDemo(behavior);

    const result = await runEvolution({
      memory,
      demonstration: demo,
      adapter: mockAdapter({ execute: () => right(behavior) }),
      approximateAction: mockApproximate(right(instance)),
      extendAction: mockExtendAction(right({
        extension: { id: "unused", description: "unused", newFields: [], newRules: [] },
        candidateInstance: { schemaId: "test", schemaVersion: "1.0.0", basePayload: {}, extensionPayload: {} },
      })),
      convergenceConfig,
    });

    expect(result.kind).toBe("assimilated");
    if (result.kind !== "assimilated") return;
    expect(result.instance).toEqual(instance);
  });

  it("returns Evolved when extension converges and codification succeeds", async () => {
    const expected = makeBehavior({ type: "a", value: 42, extra: "new" });
    const approxActual = makeBehavior({ type: "a", value: 42 }); // Missing "extra"
    const instance = makeInstance({ type: "a", value: 42 });
    const demo = makeDemo(expected);

    const result = await runEvolution({
      memory,
      demonstration: demo,
      adapter: mockAdapter({
        // Approximation compile/execute: produces behavior missing "extra"
        compile: () => right({ format: "test", artifact: { type: "a", value: 42 } }),
        execute: (executable: Executable) => {
          // During extension compile, return expected behavior
          const artifact = executable.artifact as Record<string, unknown>;
          if ("extra" in artifact) {
            return right(expected);
          }
          return right(approxActual);
        },
        compileC: () => ({
          kind: "compiled" as const,
          executable: { format: "test", artifact: { type: "a", value: 42, extra: "new" } },
        }),
      }),
      approximateAction: mockApproximate(right(instance)),
      extendAction: mockExtendAction(right({
        extension: {
          id: "add-extra",
          description: "Add extra field",
          newFields: [{ name: "extra", description: "Extra field", type: { kind: "string" }, required: false }],
          newRules: [],
        },
        candidateInstance: {
          schemaId: "test",
          schemaVersion: "1.0.0",
          basePayload: { type: "a", value: 42 },
          extensionPayload: { extra: "new" },
        },
      })),
      convergenceConfig,
    });

    expect(result.kind).toBe("evolved");
    if (result.kind !== "evolved") return;
    expect(result.iterations).toBe(1);
    expect(result.newSchema.version).toBe("1.1.0");
    expect(result.newSchema.fields.length).toBe(3); // original 2 + 1 new
  });

  it("returns Escalated when extension diverges", async () => {
    const expected = makeBehavior({ x: 1 });
    const actual = makeBehavior({ x: 999 }); // Always wrong
    const instance = makeInstance({ type: "a", value: 1 });
    const demo = makeDemo(expected);

    const result = await runEvolution({
      memory,
      demonstration: demo,
      adapter: mockAdapter({
        execute: () => right(actual),
        compileC: () => ({
          kind: "compiled" as const,
          executable: { format: "test", artifact: { x: 999 } },
        }),
      }),
      approximateAction: mockApproximate(right(instance)),
      extendAction: mockExtendAction(right({
        extension: { id: "ext", description: "ext", newFields: [], newRules: [] },
        candidateInstance: { schemaId: "test", schemaVersion: "1.0.0", basePayload: { type: "a", value: 1 }, extensionPayload: {} },
      })),
      convergenceConfig: { maxIterations: 3, gapThreshold: 1 },
    });

    expect(result.kind).toBe("escalated");
    if (result.kind !== "escalated") return;
    expect(result.iterations).toBe(3);
    expect(result.lastGap).toBeDefined();
  });

  it("returns PipelineFailed when approximation fails", async () => {
    const result = await runEvolution({
      memory,
      demonstration: makeDemo(makeBehavior({})),
      adapter: mockAdapter(),
      approximateAction: mockApproximate(
        left({ kind: "approximate", message: "LLM failed" }),
      ),
      extendAction: mockExtendAction(right({
        extension: { id: "unused", description: "unused", newFields: [], newRules: [] },
        candidateInstance: { schemaId: "test", schemaVersion: "1.0.0", basePayload: {}, extensionPayload: {} },
      })),
      convergenceConfig,
    });

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.stage).toBe(Stage.Approximate);
    expect(result.message).toBe("LLM failed");
  });

  it("returns PipelineFailed when extension action fails", async () => {
    const expected = makeBehavior({ type: "a", value: 42, missing: true });
    const actual = makeBehavior({ type: "a", value: 42 });
    const instance = makeInstance({ type: "a", value: 42 });
    const demo = makeDemo(expected);

    const result = await runEvolution({
      memory,
      demonstration: demo,
      adapter: mockAdapter({
        execute: () => right(actual),
      }),
      approximateAction: mockApproximate(right(instance)),
      extendAction: mockExtendAction(
        left({ kind: "extend", message: "Extension LLM error", iteration: 1 }),
      ),
      convergenceConfig,
    });

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.stage).toBe(Stage.Extend);
    expect(result.message).toBe("Extension LLM error");
  });
});
