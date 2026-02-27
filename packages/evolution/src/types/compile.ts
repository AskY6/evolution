/**
 * Compile types — compilation artifacts and results.
 *
 * The compile signatures are intentionally asymmetric:
 *
 * - Instance → Either<CompileError, Executable>
 *   Deterministic. The Schema is trusted and the runtime already supports it.
 *   Failure is a bug, not a design issue.
 *
 * - CandidateInstance → CompileResult (Compiled | Blocked | Degraded)
 *   Non-trivial. CandidateInstances may require runtime capabilities that
 *   don't exist yet. This three-way result encodes that uncertainty.
 */

// ---------------------------------------------------------------------------
// Executable — a compiled artifact ready for execution
// ---------------------------------------------------------------------------

/**
 * A compiled artifact that the domain runtime can execute.
 *
 * The framework is agnostic to what this contains — for BI it might be
 * an ECharts option object; for forms it might be a rendered config.
 */
export interface Executable {
  readonly format: string;
  readonly artifact: unknown;
}

// ---------------------------------------------------------------------------
// Constraint — a runtime limitation that affects compilation
// ---------------------------------------------------------------------------

/** A specific runtime constraint that blocks or degrades compilation. */
export interface Constraint {
  readonly feature: string;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// CompileResult — the three-way outcome of compiling a CandidateInstance
// ---------------------------------------------------------------------------

/** Compilation succeeded — the candidate is fully executable. */
export interface CompiledResult {
  readonly kind: "compiled";
  readonly executable: Executable;
}

/**
 * Compilation blocked — the runtime lacks required capabilities.
 *
 * Blocked constraints are converted to Gap and fed back to Extend,
 * telling it "this direction is impossible given the current runtime."
 * This is epistemological feedback — it changes the extension direction.
 */
export interface BlockedResult {
  readonly kind: "blocked";
  readonly constraints: ReadonlyArray<Constraint>;
}

/**
 * Compilation degraded — executable but with missing features.
 *
 * The artifact can run, but some capabilities are absent. The missing
 * constraints produce RuntimeUpdateTasks for the engineering team.
 */
export interface DegradedResult {
  readonly kind: "degraded";
  readonly executable: Executable;
  readonly missing: ReadonlyArray<Constraint>;
}

/** Result of compiling a CandidateInstance — reflects runtime uncertainty. */
export type CompileResult = CompiledResult | BlockedResult | DegradedResult;
