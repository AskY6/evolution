/**
 * Demonstration types — observed expert behavior.
 *
 * A Demonstration is the starting point of evolution. It represents something
 * an expert did that the system cannot yet do. The system can observe the
 * Behavior (what happened) but not the Intent (why it happened).
 *
 * > Analogy: you watch a master chef cook — you can taste the result and see
 * > the sequence of actions, but you can't see the decision logic in their head.
 */

// ---------------------------------------------------------------------------
// OpaqueSource — the raw origin of a demonstration
// ---------------------------------------------------------------------------

/**
 * The raw, opaque origin material of a Demonstration.
 *
 * The framework never interprets this directly. The domain adapter's
 * `fingerprint(raw)` method extracts structured Behavior from it.
 *
 * Examples: a Pro Code commit (BI), a form config JSON (forms domain),
 * a workflow YAML (orchestration domain).
 */
export interface OpaqueSource {
  readonly type: string;
  readonly uri?: string;
  readonly raw: unknown;
}

// ---------------------------------------------------------------------------
// Behavior — structural fingerprint of observable actions
// ---------------------------------------------------------------------------

/**
 * A structural fingerprint of what a system or expert actually did.
 *
 * Behavior is the unit of comparison: the Comparator diffs two Behaviors
 * to produce a Gap. The fingerprint must be structured enough for
 * domain-agnostic structural diffing (deep equality / subset checks).
 *
 * The domain adapter defines what dimensions the fingerprint captures.
 * For BI: API fingerprint (metrics, dimensions, filters, sort) +
 * render fingerprint (chart type, series config, axis config).
 */
export interface Behavior {
  readonly fingerprint: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Demonstration — the full observation record
// ---------------------------------------------------------------------------

/**
 * An observed expert behavior — the input that triggers evolution.
 *
 * When the system encounters a Demonstration it cannot reproduce using the
 * current Schema, evolution is triggered: Approximation exposes the Gap,
 * Extension attempts to bridge it.
 */
export interface Demonstration {
  readonly id: string;
  readonly timestamp: string;
  readonly source: OpaqueSource;
  readonly observedBehavior: Behavior;
}
