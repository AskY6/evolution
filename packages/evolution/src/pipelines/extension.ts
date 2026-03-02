/**
 * Extension pipeline — Extend → ValidateC → CompileC → Execute → Compare.
 *
 * Iterative convergence loop. Each iteration proposes a Schema extension,
 * validates it, compiles to an executable, runs it, and checks if the gap
 * has narrowed. Repeats until the gap is within threshold (Converged) or
 * max iterations are reached (Diverged).
 *
 * Blocked compilation feeds back as a RuntimeConstraint gap.
 * Degraded compilation collects RuntimeUpdateTasks and continues.
 */

import type { Schema, CandidateSchema, Extension } from "../types/schema.js";
import type { CandidateInstance } from "../types/instance.js";
import type { Gap } from "../types/gap.js";
import type { Demonstration } from "../types/demonstration.js";
import type { ConvergenceConfig, ExtensionOutcome, PipelineFailed } from "../types/pipeline.js";
import { Stage } from "../types/pipeline.js";
import { Severity, GapSource, DiscrepancyType } from "../types/gap.js";
import type { RuntimeUpdateTask } from "../types/runtime.js";
import type { Constraint } from "../types/compile.js";
import type { DomainAdapter } from "../adapter.js";
import { isLeft } from "../adapter.js";
import type { ExtendAction } from "../actions/extend.js";
import { compare } from "../comparator.js";
import { SEVERITY_ORDINAL } from "./approximation.js";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Input to the Extension pipeline. */
export interface ExtensionInput {
  readonly schema: Schema;
  readonly gap: Gap;
  readonly demonstration: Demonstration;
  readonly adapter: DomainAdapter;
  readonly extendAction: ExtendAction;
  readonly config: ConvergenceConfig;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Result of the Extension pipeline: either an outcome or a failure. */
export type ExtensionResult = ExtensionOutcome | PipelineFailed;

// ---------------------------------------------------------------------------
// Helper: constraints → Gap
// ---------------------------------------------------------------------------

/**
 * Convert Blocked constraints into a Gap with RuntimeConstraint source.
 *
 * Each constraint becomes a discrepancy indicating a missing runtime capability.
 * This feeds back into the next Extend iteration, telling the LLM that the
 * proposed direction is impossible given the current runtime.
 */
export function constraintsToGap(constraints: ReadonlyArray<Constraint>): Gap {
  const discrepancies = constraints.map((c) => ({
    path: c.feature,
    type: DiscrepancyType.Missing as const,
    expected: c.feature,
    actual: undefined as unknown,
  }));

  const severity =
    discrepancies.length >= 5
      ? Severity.Critical
      : discrepancies.length >= 3
        ? Severity.Major
        : discrepancies.length >= 1
          ? Severity.Moderate
          : Severity.Minor;

  return {
    source: GapSource.RuntimeConstraint,
    discrepancies,
    severity,
    summary: `Runtime blocked: ${constraints.map((c) => `${c.feature} (${c.reason})`).join(", ")}`,
  };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the Extension pipeline: iterative convergence loop.
 *
 * 1. Extend:   schema + gap + demo + accumulated extensions → Extension + CandidateInstance
 * 2. ValidateC: CandidateSchema + CandidateInstance → errors?
 * 3. CompileC:  CandidateInstance → CompileResult
 *    - Blocked → convert constraints to Gap (source=RuntimeConstraint), loop
 *    - Degraded → collect RuntimeUpdateTasks, continue with executable
 *    - Compiled → continue with executable
 * 4. Execute:   Executable → actual Behavior
 * 5. Compare:   expected vs actual → new Gap
 * 6. Convergence: gap severity ≤ threshold → Converged; else loop
 */
export async function runExtension(
  input: ExtensionInput,
): Promise<ExtensionResult> {
  const { schema, demonstration, adapter, extendAction, config } = input;
  let currentGap = input.gap;

  const accumulatedExtensions: Extension[] = [];
  const allRuntimeUpdateTasks: RuntimeUpdateTask[] = [];
  let latestCandidateSchema: CandidateSchema | undefined;
  let latestCandidateInstance: CandidateInstance | undefined;

  const expectedBehavior = demonstration.observedBehavior;

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    // 1. Extend: propose schema extension
    const extendResult = await extendAction.extend(
      schema,
      currentGap,
      demonstration,
      accumulatedExtensions,
    );

    if (isLeft(extendResult)) {
      return {
        kind: "failed",
        stage: Stage.Extend,
        message: extendResult.left.message,
        cause: extendResult.left,
      };
    }

    const { extension, candidateInstance } = extendResult.right;
    accumulatedExtensions.push(extension);

    // Build CandidateSchema from accumulated extensions
    const candidateSchema: CandidateSchema = {
      baseSchema: schema,
      extensions: [...accumulatedExtensions],
    };
    latestCandidateSchema = candidateSchema;
    latestCandidateInstance = candidateInstance;

    // 2. ValidateC: CandidateSchema + CandidateInstance → errors?
    const validationErrors = adapter.validateCandidate(candidateSchema, candidateInstance);
    if (validationErrors.length > 0) {
      return {
        kind: "failed",
        stage: Stage.Validate,
        message: `Candidate validation failed: ${validationErrors.map((e) => e.message).join("; ")}`,
        cause: validationErrors,
      };
    }

    // 3. CompileC: CandidateInstance → CompileResult
    const compileResult = adapter.compileC(candidateInstance);

    if (compileResult.kind === "blocked") {
      // Convert constraints to a RuntimeConstraint gap and loop
      currentGap = constraintsToGap(compileResult.constraints);
      continue;
    }

    if (compileResult.kind === "degraded") {
      // Collect runtime update tasks for engineering team
      for (const missing of compileResult.missing) {
        allRuntimeUpdateTasks.push({
          feature: missing.feature,
          description: missing.reason,
        });
      }
    }

    // At this point we have an executable (from compiled or degraded)
    const executable = compileResult.executable;

    // 4. Execute: Executable → actual Behavior
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

    // 5. Compare: expected vs actual → new Gap
    const gap = compare(expectedBehavior, actualBehavior);

    // 6. Convergence check: gap severity ≤ threshold → Converged
    if (SEVERITY_ORDINAL[gap.severity] <= config.gapThreshold) {
      return {
        kind: "converged",
        candidateSchema,
        candidateInstance,
        iterations: iteration,
        runtimeUpdateTasks: allRuntimeUpdateTasks,
      };
    }

    // Not converged — update gap and continue
    currentGap = gap;
  }

  // Max iterations reached without convergence → Diverged
  return {
    kind: "diverged",
    iterations: config.maxIterations,
    lastGap: currentGap,
  };
}
