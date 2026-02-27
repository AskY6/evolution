/**
 * Gap types — the structured difference between expected and actual behavior.
 *
 * A Gap is the learning signal. It tells the system precisely what the current
 * Schema cannot express. The Comparator produces Gaps; the Extend action
 * consumes them to propose Schema extensions.
 *
 * Gaps also arise from runtime constraints (Blocked compilation), flowing
 * through the same feedback channel as behavioral gaps.
 */

// ---------------------------------------------------------------------------
// Severity — how critical a gap is
// ---------------------------------------------------------------------------

/** How critical a Gap is — drives pipeline decisions (retry, escalate, etc). */
export enum Severity {
  /** Small difference, likely cosmetic. */
  Minor = "minor",
  /** Noticeable difference that affects output quality. */
  Moderate = "moderate",
  /** Significant structural difference — core behavior diverges. */
  Major = "major",
  /** Fundamental mismatch — the Schema lacks the concept entirely. */
  Critical = "critical",
}

// ---------------------------------------------------------------------------
// Discrepancy — a single point of divergence
// ---------------------------------------------------------------------------

/** The category of a discrepancy — what kind of difference was found. */
export enum DiscrepancyType {
  /** A field/key is present in expected but missing in actual. */
  Missing = "missing",
  /** A field/key is present in actual but absent from expected. */
  Extra = "extra",
  /** Both present, but values differ. */
  ValueMismatch = "value_mismatch",
  /** Both present, but structural types differ (e.g. object vs array). */
  TypeMismatch = "type_mismatch",
}

/**
 * A single point of divergence between two Behaviors.
 *
 * The `path` uses dot-notation to locate the discrepancy within the
 * fingerprint structure (e.g. "render.chartType", "api.filters[0].field").
 */
export interface Discrepancy {
  readonly path: string;
  readonly type: DiscrepancyType;
  readonly expected: unknown;
  readonly actual: unknown;
}

// ---------------------------------------------------------------------------
// GapSource — where a gap originated
// ---------------------------------------------------------------------------

/** Whether a Gap came from behavioral comparison or runtime constraints. */
export enum GapSource {
  /** Produced by the Comparator — behavior doesn't match. */
  Behavioral = "behavioral",
  /** Produced by CompileC Blocked → constraintsToGap conversion. */
  RuntimeConstraint = "runtime_constraint",
}

// ---------------------------------------------------------------------------
// Gap — the aggregate learning signal
// ---------------------------------------------------------------------------

/**
 * The structured difference between expected and actual behavior.
 *
 * For the Extend action, a Gap is an instruction: "to eliminate these
 * discrepancies, the Schema needs to change in these specific ways."
 */
export interface Gap {
  readonly source: GapSource;
  readonly discrepancies: ReadonlyArray<Discrepancy>;
  readonly severity: Severity;
  readonly summary: string;
}
