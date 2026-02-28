import { describe, it, expect } from "vitest";
import { runExtension, constraintsToGap } from "../../packages/evolution/src/pipelines/extension.js";
import type { ExtensionInput } from "../../packages/evolution/src/pipelines/extension.js";
import type { Schema, Extension, CandidateSchema } from "../../packages/evolution/src/types/schema.js";
import type { CandidateInstance } from "../../packages/evolution/src/types/instance.js";
import type { Behavior, Demonstration } from "../../packages/evolution/src/types/demonstration.js";
import type { Gap, Discrepancy } from "../../packages/evolution/src/types/gap.js";
import { Severity, DiscrepancyType, GapSource } from "../../packages/evolution/src/types/gap.js";
import type { DomainAdapter } from "../../packages/evolution/src/adapter.js";
import type { ExtendAction, ExtendResult } from "../../packages/evolution/src/actions/extend.js";
import type { Either } from "../../packages/evolution/src/adapter.js";
import type { ExtendError } from "../../packages/evolution/src/types/errors.js";
import type { Executable, CompileResult } from "../../packages/evolution/src/types/compile.js";
import type { RuntimeCapability } from "../../packages/evolution/src/types/runtime.js";
import type { ConvergenceConfig, PipelineFailed } from "../../packages/evolution/src/types/pipeline.js";
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

function makeBehavior(fingerprint: Record<string, unknown>): Behavior {
  return { fingerprint };
}

function makeGap(overrides?: Partial<Gap>): Gap {
  return {
    source: GapSource.Behavioral,
    discrepancies: [
      { path: "extra.field", type: DiscrepancyType.Missing, expected: "value", actual: undefined },
    ],
    severity: Severity.Major,
    summary: "Test gap",
    ...overrides,
  };
}

function makeDemo(behavior: Behavior): Demonstration {
  return {
    id: "demo-1",
    timestamp: "2026-01-01T00:00:00Z",
    source: { type: "test", raw: "test input" },
    observedBehavior: behavior,
  };
}

function makeExtension(id: string): Extension {
  return {
    id,
    description: `Extension ${id}`,
    newFields: [
      { name: `field_${id}`, description: `Field from ${id}`, type: { kind: "string" }, required: false },
    ],
    newRules: [],
  };
}

function makeCandidateInstance(): CandidateInstance {
  return {
    schemaId: "test",
    schemaVersion: "1.0.0",
    basePayload: { type: "a", value: 42 },
    extensionPayload: { field_ext1: "hello" },
  };
}

const defaultConfig: ConvergenceConfig = {
  maxIterations: 5,
  gapThreshold: 2, // Moderate or below = converged
};

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

function mockAdapter(overrides?: {
  compileC?: DomainAdapter["compileC"];
  execute?: DomainAdapter["execute"];
}): DomainAdapter {
  return {
    compile: () => right({ format: "test", artifact: {} }),
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
// Mock extend action
// ---------------------------------------------------------------------------

function mockExtendAction(overrides?: {
  results?: Array<Either<ExtendError, ExtendResult>>;
}): ExtendAction {
  let callIndex = 0;
  const results = overrides?.results ?? [
    right({
      extension: makeExtension("ext1"),
      candidateInstance: makeCandidateInstance(),
    }),
  ];

  return {
    extend: async () => {
      const idx = Math.min(callIndex++, results.length - 1);
      return results[idx];
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: constraintsToGap
// ---------------------------------------------------------------------------

describe("constraintsToGap", () => {
  it("converts constraints to a RuntimeConstraint gap", () => {
    const gap = constraintsToGap([
      { feature: "chart:radar", reason: "Not supported" },
      { feature: "axis:time", reason: "Feasible but not yet implemented" },
    ]);

    expect(gap.source).toBe(GapSource.RuntimeConstraint);
    expect(gap.discrepancies).toHaveLength(2);
    expect(gap.discrepancies[0].path).toBe("chart:radar");
    expect(gap.discrepancies[0].type).toBe(DiscrepancyType.Missing);
    expect(gap.severity).toBe(Severity.Moderate);
    expect(gap.summary).toContain("chart:radar");
  });

  it("returns Minor severity for empty constraints", () => {
    const gap = constraintsToGap([]);
    expect(gap.severity).toBe(Severity.Minor);
    expect(gap.discrepancies).toHaveLength(0);
  });

  it("returns Major severity for 3+ constraints", () => {
    const gap = constraintsToGap([
      { feature: "a", reason: "r" },
      { feature: "b", reason: "r" },
      { feature: "c", reason: "r" },
    ]);
    expect(gap.severity).toBe(Severity.Major);
  });

  it("returns Critical severity for 5+ constraints", () => {
    const gap = constraintsToGap([
      { feature: "a", reason: "r" },
      { feature: "b", reason: "r" },
      { feature: "c", reason: "r" },
      { feature: "d", reason: "r" },
      { feature: "e", reason: "r" },
    ]);
    expect(gap.severity).toBe(Severity.Critical);
  });
});

// ---------------------------------------------------------------------------
// Tests: runExtension
// ---------------------------------------------------------------------------

describe("runExtension", () => {
  it("converges when extension produces matching behavior on first iteration", async () => {
    const expected = makeBehavior({ type: "a", value: 42 });
    const demo = makeDemo(expected);

    const result = await runExtension({
      schema,
      gap: makeGap(),
      demonstration: demo,
      adapter: mockAdapter({
        // Return behavior matching expected
        execute: () => right(expected),
      }),
      extendAction: mockExtendAction(),
      config: defaultConfig,
    });

    expect(result.kind).toBe("converged");
    if (result.kind !== "converged") return;
    expect(result.iterations).toBe(1);
    expect(result.candidateSchema.baseSchema).toEqual(schema);
    expect(result.candidateSchema.extensions).toHaveLength(1);
  });

  it("diverges when max iterations reached without convergence", async () => {
    const expected = makeBehavior({ x: 1 });
    const actual = makeBehavior({ x: 999 }); // Always different
    const demo = makeDemo(expected);

    // Use empty extensionPayload to avoid validation issues with field mismatches
    const candidateInstance: CandidateInstance = {
      schemaId: "test",
      schemaVersion: "1.0.0",
      basePayload: { type: "a", value: 42 },
      extensionPayload: {},
    };
    const emptyExtension = { id: "ext", description: "Ext", newFields: [], newRules: [] };

    const result = await runExtension({
      schema,
      gap: makeGap(),
      demonstration: demo,
      adapter: mockAdapter({
        execute: () => right(actual),
      }),
      extendAction: mockExtendAction({
        results: Array(3).fill(right({
          extension: emptyExtension,
          candidateInstance,
        })),
      }),
      config: { maxIterations: 3, gapThreshold: 1 },
    });

    expect(result.kind).toBe("diverged");
    if (result.kind !== "diverged") return;
    expect(result.iterations).toBe(3);
    expect(result.lastGap).toBeDefined();
  });

  it("handles Blocked compilation by converting constraints to gap and retrying", async () => {
    let callCount = 0;

    const expected = makeBehavior({ type: "a" });
    const demo = makeDemo(expected);

    const result = await runExtension({
      schema,
      gap: makeGap(),
      demonstration: demo,
      adapter: mockAdapter({
        compileC: () => {
          callCount++;
          if (callCount === 1) {
            return {
              kind: "blocked",
              constraints: [{ feature: "chart:radar", reason: "Not supported" }],
            };
          }
          return {
            kind: "compiled",
            executable: { format: "test", artifact: { type: "a" } },
          };
        },
        execute: () => right(expected),
      }),
      extendAction: mockExtendAction({
        results: [
          right({ extension: makeExtension("ext1"), candidateInstance: makeCandidateInstance() }),
          right({ extension: makeExtension("ext2"), candidateInstance: makeCandidateInstance() }),
        ],
      }),
      config: defaultConfig,
    });

    expect(result.kind).toBe("converged");
    if (result.kind !== "converged") return;
    expect(result.iterations).toBe(2);
    // First iteration was blocked → second iteration succeeded
    expect(callCount).toBe(2);
  });

  it("collects RuntimeUpdateTasks from Degraded compilation", async () => {
    const expected = makeBehavior({ type: "a" });
    const demo = makeDemo(expected);

    const result = await runExtension({
      schema,
      gap: makeGap(),
      demonstration: demo,
      adapter: mockAdapter({
        compileC: () => ({
          kind: "degraded",
          executable: { format: "test", artifact: { type: "a" } },
          missing: [{ feature: "chart:pie", reason: "Feasible, needs implementation" }],
        }),
        execute: () => right(expected),
      }),
      extendAction: mockExtendAction(),
      config: defaultConfig,
    });

    expect(result.kind).toBe("converged");
    if (result.kind !== "converged") return;
    expect(result.runtimeUpdateTasks).toHaveLength(1);
    expect(result.runtimeUpdateTasks[0].feature).toBe("chart:pie");
  });

  it("returns PipelineFailed when extendAction fails", async () => {
    const result = await runExtension({
      schema,
      gap: makeGap(),
      demonstration: makeDemo(makeBehavior({})),
      adapter: mockAdapter(),
      extendAction: mockExtendAction({
        results: [left({ kind: "extend", message: "LLM error", iteration: 1 })],
      }),
      config: defaultConfig,
    });

    expect(result.kind).toBe("failed");
    const failed = result as PipelineFailed;
    expect(failed.stage).toBe(Stage.Extend);
    expect(failed.message).toBe("LLM error");
  });

  it("returns PipelineFailed at Execute stage on execution error", async () => {
    const result = await runExtension({
      schema,
      gap: makeGap(),
      demonstration: makeDemo(makeBehavior({})),
      adapter: mockAdapter({
        execute: () => left({ kind: "execute", message: "Runtime crash" }),
      }),
      extendAction: mockExtendAction(),
      config: defaultConfig,
    });

    expect(result.kind).toBe("failed");
    const failed = result as PipelineFailed;
    expect(failed.stage).toBe(Stage.Execute);
    expect(failed.message).toBe("Runtime crash");
  });

  it("accumulates extensions across iterations", async () => {
    let iteration = 0;
    const expected = makeBehavior({ x: 100 });
    const demo = makeDemo(expected);

    // Each CandidateInstance has empty extensionPayload to avoid field mismatch
    const candidateInstance: CandidateInstance = {
      schemaId: "test",
      schemaVersion: "1.0.0",
      basePayload: { type: "a", value: 42 },
      extensionPayload: {},
    };
    const emptyExt = (id: string) => ({
      id,
      description: `Extension ${id}`,
      newFields: [] as Extension["newFields"],
      newRules: [] as Extension["newRules"],
    });

    const result = await runExtension({
      schema,
      gap: makeGap(),
      demonstration: demo,
      adapter: mockAdapter({
        execute: () => {
          iteration++;
          // Converge on third iteration
          if (iteration >= 3) {
            return right(expected);
          }
          return right(makeBehavior({ x: iteration }));
        },
      }),
      extendAction: mockExtendAction({
        results: [
          right({ extension: emptyExt("ext1"), candidateInstance }),
          right({ extension: emptyExt("ext2"), candidateInstance }),
          right({ extension: emptyExt("ext3"), candidateInstance }),
        ],
      }),
      config: { maxIterations: 5, gapThreshold: 1 },
    });

    expect(result.kind).toBe("converged");
    if (result.kind !== "converged") return;
    expect(result.iterations).toBe(3);
    expect(result.candidateSchema.extensions).toHaveLength(3);
  });
});
