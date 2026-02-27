/**
 * Memory types — the system's accumulated knowledge.
 *
 * Memory tracks Schema evolution over time: which versions exist, how they
 * were derived, and what demonstrations triggered each evolution.
 *
 * Promote: Candidate* + Memory → Memory′ is the only way Memory changes.
 */

import type { Schema } from "./schema.js";
import type { Gap } from "./gap.js";

// ---------------------------------------------------------------------------
// EvolutionOutcome — how an evolution attempt ended
// ---------------------------------------------------------------------------

export enum EvolutionOutcome {
  /** Extension converged, candidate was promoted to current. */
  Success = "success",
  /** Extension diverged or errored — no Schema change. */
  Failure = "failure",
  /** Extension reached a point requiring human judgment. */
  NeedsHumanReview = "needs_human_review",
}

// ---------------------------------------------------------------------------
// EvolutionRecord — a single evolution event
// ---------------------------------------------------------------------------

/** A single evolution event in the system's history. */
export interface EvolutionRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly demonstrationId: string;
  readonly outcome: EvolutionOutcome;
  /** Schema version before this evolution (always present). */
  readonly fromSchemaVersion: string;
  /** Schema version after this evolution (present only on success). */
  readonly toSchemaVersion?: string;
  /** The gap that triggered extension (present when approximation found insufficient). */
  readonly gap?: Gap;
  /** Number of extension iterations before convergence/divergence. */
  readonly iterations?: number;
  /** Human-readable summary of what happened. */
  readonly summary?: string;
}

// ---------------------------------------------------------------------------
// Memory — the complete knowledge state
// ---------------------------------------------------------------------------

/**
 * The system's accumulated knowledge — the current Schema and the full
 * history of how it got there.
 *
 * Memory is the single source of truth for "what the system knows."
 * It is updated atomically by the Promote action.
 */
export interface Memory {
  readonly currentSchema: Schema;
  readonly schemaHistory: ReadonlyArray<Schema>;
  readonly records: ReadonlyArray<EvolutionRecord>;
}
