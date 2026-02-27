import { describe, it, expect } from "vitest";
import { runApproximation, SEVERITY_ORDINAL } from "../../packages/evolution/src/pipelines/approximation.js";
import type { ApproximationInput } from "../../packages/evolution/src/pipelines/approximation.js";
import type { Schema } from "../../packages/evolution/src/types/schema.js";
import type { Instance } from "../../packages/evolution/src/types/instance.js";
import type { Behavior, Demonstration } from "../../packages/evolution/src/types/demonstration.js";
import type { DomainAdapter } from "../../packages/evolution/src/adapter.js";
import type { ApproximateAction } from "../../packages/evolution/src/actions/approximate.js";
import type { Either } from "../../packages/evolution/src/adapter.js";
import type { ApproximateError } from "../../packages/evolution/src/types/errors.js";
import type { Executable } from "../../packages/evolution/src/types/compile.js";
import type { RuntimeCapability } from "../../packages/evolution/src/types/runtime.js";
import type { PipelineFailed } from "../../packages/evolution/src/types/pipeline.js";
import { left, right } from "../../packages/evolution/src/adapter.js";
import { Stage } from "../../packages/evolution/src/types/pipeline.js";
import { Severity } from "../../packages/evolution/src/types/gap.js";

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

function makeInstance(payload: Record<string, unknown>): Instance {
  return { schemaId: "test", schemaVersion: "1.0.0", payload };
}

function makeBehavior(fingerprint: Record<string, unknown>): Behavior {
  return { fingerprint };
}

function makeDemo(behavior: Behavior): Demonstration {
  return {
    id: "demo-1",
    timestamp: "2026-01-01T00:00:00Z",
    source: { type: "test", raw: "test input" },
    observedBehavior: behavior,
  };
}

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

function mockAdapter(overrides?: {
  compile?: DomainAdapter["compile"];
  execute?: DomainAdapter["execute"];
}): DomainAdapter {
  return {
    compile: overrides?.compile ?? ((instance: Instance) =>
      right({ format: "test", artifact: instance.payload })),
    execute: overrides?.execute ?? ((executable: Executable) =>
      right(makeBehavior(executable.artifact as Record<string, unknown>))),
    compileC: () => ({ kind: "compiled", executable: { format: "test", artifact: {} } }),
    fingerprint: (raw: unknown) => makeBehavior(raw as Record<string, unknown>),
    runtime: (): RuntimeCapability => ({ features: [] }),
  };
}

// ---------------------------------------------------------------------------
// Mock approximate action
// ---------------------------------------------------------------------------

function mockApproximate(
  result: Either<ApproximateError, Instance>,
): ApproximateAction {
  return {
    approximate: async () => result,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runApproximation", () => {
  it("returns Sufficient when behaviors match exactly", async () => {
    const behavior = makeBehavior({ type: "a", value: 42 });
    const instance = makeInstance({ type: "a", value: 42 });

    const result = await runApproximation({
      schema,
      demonstration: makeDemo(behavior),
      adapter: mockAdapter({
        execute: () => right(behavior),
      }),
      approximateAction: mockApproximate(right(instance)),
    });

    expect(result.kind).toBe("sufficient");
    if (result.kind !== "sufficient") return;
    expect(result.instance).toEqual(instance);
    expect(result.behavior).toEqual(behavior);
  });

  it("returns Sufficient when gap severity is below threshold", async () => {
    const expected = makeBehavior({ type: "a", value: 42, label: "hello" });
    const actual = makeBehavior({ type: "a", value: 42, label: "world" });
    const instance = makeInstance({ type: "a", value: 42 });

    // A single value mismatch produces Moderate severity from the comparator.
    // With threshold=2 (Moderate), this should be Sufficient.
    const result = await runApproximation({
      schema,
      demonstration: makeDemo(expected),
      adapter: mockAdapter({ execute: () => right(actual) }),
      approximateAction: mockApproximate(right(instance)),
      config: { severityThreshold: 2 },
    });

    expect(result.kind).toBe("sufficient");
  });

  it("returns Insufficient when behavior differs with gap", async () => {
    const expected = makeBehavior({ type: "a", value: 42 });
    const actual = makeBehavior({ type: "b", value: 99 });
    const instance = makeInstance({ type: "a", value: 42 });

    const result = await runApproximation({
      schema,
      demonstration: makeDemo(expected),
      adapter: mockAdapter({ execute: () => right(actual) }),
      approximateAction: mockApproximate(right(instance)),
    });

    expect(result.kind).toBe("insufficient");
    if (result.kind !== "insufficient") return;
    expect(result.gap.discrepancies.length).toBeGreaterThan(0);
    expect(result.instance).toEqual(instance);
    expect(result.observedBehavior).toEqual(expected);
    expect(result.behavior).toEqual(actual);
  });

  it("returns Insufficient for value mismatch at default threshold", async () => {
    const expected = makeBehavior({ score: 100 });
    const actual = makeBehavior({ score: 50 });
    const instance = makeInstance({ type: "a", value: 1 });

    const result = await runApproximation({
      schema,
      demonstration: makeDemo(expected),
      adapter: mockAdapter({ execute: () => right(actual) }),
      approximateAction: mockApproximate(right(instance)),
    });

    // Single value mismatch = Moderate, default threshold = 1 (Minor) → Insufficient
    expect(result.kind).toBe("insufficient");
  });

  it("returns PipelineFailed at Approximate stage on error", async () => {
    const result = await runApproximation({
      schema,
      demonstration: makeDemo(makeBehavior({})),
      adapter: mockAdapter(),
      approximateAction: mockApproximate(
        left({ kind: "approximate", message: "LLM failed" }),
      ),
    });

    expect(result.kind).toBe("failed");
    const failed = result as PipelineFailed;
    expect(failed.stage).toBe(Stage.Approximate);
    expect(failed.message).toBe("LLM failed");
  });

  it("returns PipelineFailed at Validate stage on invalid instance", async () => {
    const badInstance: Instance = {
      schemaId: "wrong",
      schemaVersion: "1.0.0",
      payload: { type: "a", value: 42 },
    };

    const result = await runApproximation({
      schema,
      demonstration: makeDemo(makeBehavior({})),
      adapter: mockAdapter(),
      approximateAction: mockApproximate(right(badInstance)),
    });

    expect(result.kind).toBe("failed");
    const failed = result as PipelineFailed;
    expect(failed.stage).toBe(Stage.Validate);
    expect(failed.message).toContain("Validation failed");
  });

  it("returns PipelineFailed at Compile stage on compile error", async () => {
    const instance = makeInstance({ type: "a", value: 42 });

    const result = await runApproximation({
      schema,
      demonstration: makeDemo(makeBehavior({})),
      adapter: mockAdapter({
        compile: () => left({ kind: "compile", message: "Compilation error" }),
      }),
      approximateAction: mockApproximate(right(instance)),
    });

    expect(result.kind).toBe("failed");
    const failed = result as PipelineFailed;
    expect(failed.stage).toBe(Stage.Compile);
    expect(failed.message).toBe("Compilation error");
  });

  it("returns PipelineFailed at Execute stage on execution error", async () => {
    const instance = makeInstance({ type: "a", value: 42 });

    const result = await runApproximation({
      schema,
      demonstration: makeDemo(makeBehavior({})),
      adapter: mockAdapter({
        execute: () => left({ kind: "execute", message: "Runtime crash" }),
      }),
      approximateAction: mockApproximate(right(instance)),
    });

    expect(result.kind).toBe("failed");
    const failed = result as PipelineFailed;
    expect(failed.stage).toBe(Stage.Execute);
    expect(failed.message).toBe("Runtime crash");
  });

  it("uses custom severity threshold", async () => {
    const expected = makeBehavior({ a: 1, b: 2, c: 3 });
    // Missing keys produce Major severity in comparator (any Missing → Major)
    const actual = makeBehavior({ a: 1 });
    const instance = makeInstance({ type: "a", value: 1 });

    // Threshold = 3 (Major) → should be Sufficient even with missing keys
    const result = await runApproximation({
      schema,
      demonstration: makeDemo(expected),
      adapter: mockAdapter({ execute: () => right(actual) }),
      approximateAction: mockApproximate(right(instance)),
      config: { severityThreshold: 3 },
    });

    expect(result.kind).toBe("sufficient");
  });

  it("uses default threshold of 1 (Minor)", async () => {
    // With identical behaviors (Minor severity, ordinal=1), default threshold should pass
    const behavior = makeBehavior({ x: 1 });
    const instance = makeInstance({ type: "a", value: 1 });

    const result = await runApproximation({
      schema,
      demonstration: makeDemo(behavior),
      adapter: mockAdapter({ execute: () => right(behavior) }),
      approximateAction: mockApproximate(right(instance)),
    });

    expect(result.kind).toBe("sufficient");
  });
});

describe("SEVERITY_ORDINAL", () => {
  it("maps Minor=1, Moderate=2, Major=3, Critical=4", () => {
    expect(SEVERITY_ORDINAL[Severity.Minor]).toBe(1);
    expect(SEVERITY_ORDINAL[Severity.Moderate]).toBe(2);
    expect(SEVERITY_ORDINAL[Severity.Major]).toBe(3);
    expect(SEVERITY_ORDINAL[Severity.Critical]).toBe(4);
  });
});
