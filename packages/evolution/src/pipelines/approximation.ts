/**
 * Approximation pipeline — Approximate → Validate → Compile → Execute → Compare.
 *
 * All Current types. Produces Sufficient (schema can express the demonstration)
 * or Insufficient (gap between current schema and expert behavior).
 */

import type { Schema } from "../types/schema.js";
import type { Demonstration } from "../types/demonstration.js";
import type { ApproximateAction } from "../actions/approximate.js";
import type { DomainAdapter } from "../adapter.js";
import { isLeft } from "../adapter.js";
import { validateInstance } from "../validator.js";
import { compare } from "../comparator.js";
import type { ApproxOutcome, PipelineFailed } from "../types/pipeline.js";
import { Stage } from "../types/pipeline.js";
import { Severity } from "../types/gap.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Configuration for the Approximation pipeline. */
export interface ApproximationConfig {
  /**
   * Severity threshold (ordinal). Default 1 (only Minor is sufficient).
   * Minor=1, Moderate=2, Major=3, Critical=4.
   * Gap severity ≤ threshold → Sufficient.
   */
  readonly severityThreshold?: number;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Input to the Approximation pipeline. */
export interface ApproximationInput {
  readonly schema: Schema;
  readonly demonstration: Demonstration;
  readonly adapter: DomainAdapter;
  readonly approximateAction: ApproximateAction;
  readonly config?: ApproximationConfig;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Result of the Approximation pipeline: either an outcome or a failure. */
export type ApproximationResult = ApproxOutcome | PipelineFailed;

// ---------------------------------------------------------------------------
// Severity ordinal mapping
// ---------------------------------------------------------------------------

export const SEVERITY_ORDINAL: Record<Severity, number> = {
  [Severity.Minor]: 1,
  [Severity.Moderate]: 2,
  [Severity.Major]: 3,
  [Severity.Critical]: 4,
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the Approximation pipeline: Approximate → Validate → Compile → Execute → Compare.
 *
 * 1. Extract expected behavior from the demonstration
 * 2. Approximate an Instance from the Schema + Demonstration
 * 3. Validate the Instance against the Schema
 * 4. Compile the Instance into an Executable
 * 5. Execute the Executable to produce actual Behavior
 * 6. Compare expected vs actual → Gap
 * 7. Gap severity ≤ threshold → Sufficient; else → Insufficient
 */
export async function runApproximation(
  input: ApproximationInput,
): Promise<ApproximationResult> {
  const { schema, demonstration, adapter, approximateAction, config } = input;
  const threshold = config?.severityThreshold ?? 1;

  // 1. Expected behavior from demonstration
  const expectedBehavior = demonstration.observedBehavior;

  // 2. Approximate: Schema + Demonstration → Instance
  const approxResult = await approximateAction.approximate(schema, demonstration);
  if (isLeft(approxResult)) {
    return {
      kind: "failed",
      stage: Stage.Approximate,
      message: approxResult.left.message,
      cause: approxResult.left,
    };
  }
  const instance = approxResult.right;

  // 3. Validate: Schema + Instance → errors?
  const errors = validateInstance(schema, instance);
  if (errors.length > 0) {
    return {
      kind: "failed",
      stage: Stage.Validate,
      message: `Validation failed: ${errors.map((e) => e.message).join("; ")}`,
      cause: errors,
    };
  }

  // 4. Compile: Instance → Executable
  const compileResult = adapter.compile(instance);
  if (isLeft(compileResult)) {
    return {
      kind: "failed",
      stage: Stage.Compile,
      message: compileResult.left.message,
      cause: compileResult.left,
    };
  }
  const executable = compileResult.right;

  // 5. Execute: Executable → actualBehavior
  const execResult = adapter.execute(executable);
  if (isLeft(execResult)) {
    return {
      kind: "failed",
      stage: Stage.Execute,
      message: execResult.left.message,
      cause: execResult.left,
    };
  }
  const actualBehavior = execResult.right;

  // 6. Compare: expectedBehavior × actualBehavior → Gap
  const gap = compare(expectedBehavior, actualBehavior);

  // 7. Gap severity ≤ threshold → Sufficient; else → Insufficient
  if (SEVERITY_ORDINAL[gap.severity] <= threshold) {
    return {
      kind: "sufficient",
      instance,
      behavior: actualBehavior,
    };
  }

  return {
    kind: "insufficient",
    instance,
    gap,
    behavior: actualBehavior,
    observedBehavior: expectedBehavior,
  };
}
