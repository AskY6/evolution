/**
 * Runtime types — capability declarations.
 *
 * The Runtime is not the executor itself — it is a declaration of what the
 * execution environment can and cannot do. The framework uses this to
 * determine whether a CandidateInstance can be compiled.
 *
 * Three states:
 * - Supported: compile directly.
 * - Feasible: achievable with engineering effort → produces RuntimeUpdateTask.
 * - Unfeasible: cannot be supported → back-pressure to Extend (epistemological feedback).
 */

// ---------------------------------------------------------------------------
// Supportability — the three states
// ---------------------------------------------------------------------------

export enum Supportability {
  /** Already supported — compile directly, no action needed. */
  Supported = "supported",
  /** Achievable with engineering effort — produces a RuntimeUpdateTask for humans. */
  Feasible = "feasible",
  /** Cannot be supported by this runtime — back-pressure to Extend to change direction. */
  Unfeasible = "unfeasible",
}

// ---------------------------------------------------------------------------
// Feature — a single runtime capability
// ---------------------------------------------------------------------------

/** A single capability of the runtime environment. */
export interface Feature {
  readonly name: string;
  readonly supportability: Supportability;
  /** Human-readable description of the capability or limitation. */
  readonly description?: string;
}

// ---------------------------------------------------------------------------
// RuntimeCapability — the full capability declaration
// ---------------------------------------------------------------------------

/** A complete declaration of what the current runtime environment can execute. */
export interface RuntimeCapability {
  readonly features: ReadonlyArray<Feature>;
}

// ---------------------------------------------------------------------------
// RuntimeUpdateTask — engineering work needed for Feasible features
// ---------------------------------------------------------------------------

/**
 * A work item for human engineers: "the framework extension is correct,
 * but the runtime needs to be upgraded to support this feature."
 *
 * This is not a framework concern — it's an output that gets handed off
 * to the engineering team. Feasible is an engineering task; Unfeasible is
 * epistemological feedback that changes the extension direction.
 */
export interface RuntimeUpdateTask {
  readonly feature: string;
  readonly description: string;
  readonly estimatedEffort?: string;
}
