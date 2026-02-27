/**
 * Pipeline types — results and configuration for evolution pipelines.
 *
 * The system has three pipelines:
 * 1. Approximation: Approximate → Validate → Compile → Execute → Compare
 *    All Current types. Produces Sufficient or Insufficient(Gap).
 * 2. Extension: Extend → ValidateC → CompileC → Execute → Compare (iterates)
 *    Candidate types. Converges, diverges, or escalates.
 * 3. Evolution: Approximation → Extension (if needed) → Codification
 *    Full orchestration. Atomic — no half-finished state.
 */

import type { Gap } from "./gap.js";
import type { Instance, CandidateInstance } from "./instance.js";
import type { Schema, CandidateSchema } from "./schema.js";
import type { Behavior } from "./demonstration.js";
import type { RuntimeUpdateTask } from "./runtime.js";

// ---------------------------------------------------------------------------
// Stage — named steps in the pipeline
// ---------------------------------------------------------------------------

/** Named stages in the evolution pipeline, for error context and tracing. */
export enum Stage {
  Approximate = "approximate",
  Validate = "validate",
  Compile = "compile",
  Execute = "execute",
  Compare = "compare",
  Extend = "extend",
  Promote = "promote",
}

// ---------------------------------------------------------------------------
// ApproxOutcome — Phase A result
// ---------------------------------------------------------------------------

/**
 * The current Schema is sufficient — the expert behavior can be expressed
 * as an Instance without any Schema changes.
 */
export interface Sufficient {
  readonly kind: "sufficient";
  readonly instance: Instance;
  readonly behavior: Behavior;
}

/**
 * The current Schema is insufficient — there is a Gap between what the
 * system can express and what the expert demonstrated. Triggers Phase B.
 */
export interface Insufficient {
  readonly kind: "insufficient";
  readonly instance: Instance;
  readonly gap: Gap;
  readonly behavior: Behavior;
  readonly observedBehavior: Behavior;
}

/** Outcome of the Approximation pipeline (Phase A). */
export type ApproxOutcome = Sufficient | Insufficient;

// ---------------------------------------------------------------------------
// ExtensionOutcome — Phase B result
// ---------------------------------------------------------------------------

/**
 * Extension converged — the candidate schema + instance reproduce the
 * expert behavior within the gap threshold.
 */
export interface Converged {
  readonly kind: "converged";
  readonly candidateSchema: CandidateSchema;
  readonly candidateInstance: CandidateInstance;
  readonly iterations: number;
  readonly runtimeUpdateTasks: ReadonlyArray<RuntimeUpdateTask>;
}

/** Extension diverged — max iterations reached without convergence. */
export interface Diverged {
  readonly kind: "diverged";
  readonly iterations: number;
  readonly lastGap: Gap;
}

/** Outcome of the Extension pipeline (Phase B). */
export type ExtensionOutcome = Converged | Diverged;

// ---------------------------------------------------------------------------
// EvolutionResult — full pipeline result
// ---------------------------------------------------------------------------

/** Evolution succeeded: Schema was extended and promoted. */
export interface Evolved {
  readonly kind: "evolved";
  readonly newSchema: Schema;
  readonly iterations: number;
}

/** Evolution was not needed: current Schema is sufficient. */
export interface Assimilated {
  readonly kind: "assimilated";
  readonly instance: Instance;
}

/** Evolution failed to converge, escalated for human review. */
export interface Escalated {
  readonly kind: "escalated";
  readonly iterations: number;
  readonly lastGap: Gap;
}

/** Evolution pipeline failed with an error at a specific stage. */
export interface PipelineFailed {
  readonly kind: "failed";
  readonly stage: Stage;
  readonly message: string;
  readonly cause?: unknown;
}

/** Outcome of the full Evolution pipeline. */
export type EvolutionResult = Evolved | Assimilated | Escalated | PipelineFailed;

// ---------------------------------------------------------------------------
// ConvergenceConfig — controls the extension loop
// ---------------------------------------------------------------------------

/** Configuration for the extension iteration loop. */
export interface ConvergenceConfig {
  /** Maximum number of Extend → Validate → Compile → Execute → Compare iterations. */
  readonly maxIterations: number;
  /**
   * Gap severity threshold below which the gap is considered "close enough."
   * Mapped from Severity enum ordinals: minor=1, moderate=2, major=3, critical=4.
   */
  readonly gapThreshold: number;
}
