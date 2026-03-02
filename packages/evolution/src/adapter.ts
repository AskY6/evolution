/**
 * DomainAdapter — the single integration point between framework and domain.
 *
 * This is the only interface a domain package needs to implement.
 * The framework never reaches past this interface into domain internals.
 *
 * Dependency rule: packages/bi → packages/evolution ONLY via DomainAdapter.
 */

import type { Schema, CandidateSchema, Extension } from "./types/schema.js";
import type { Instance, CandidateInstance } from "./types/instance.js";
import type { CompileResult, Executable } from "./types/compile.js";
import type { CompileError, ExecuteError, ValidationError } from "./types/errors.js";
import type { Behavior } from "./types/demonstration.js";
import type { RuntimeCapability } from "./types/runtime.js";

// ---------------------------------------------------------------------------
// Either — discriminated success/failure union
// ---------------------------------------------------------------------------

/** Failure case. */
export interface Left<E> {
  readonly _tag: "Left";
  readonly left: E;
}

/** Success case. */
export interface Right<A> {
  readonly _tag: "Right";
  readonly right: A;
}

/** Discriminated union: Left (failure) or Right (success). */
export type Either<E, A> = Left<E> | Right<A>;

/** Construct a Left (failure). */
export function left<E, A = never>(value: E): Either<E, A> {
  return { _tag: "Left", left: value };
}

/** Construct a Right (success). */
export function right<A, E = never>(value: A): Either<E, A> {
  return { _tag: "Right", right: value };
}

/** Type guard: is this a Left? */
export function isLeft<E, A>(either: Either<E, A>): either is Left<E> {
  return either._tag === "Left";
}

/** Type guard: is this a Right? */
export function isRight<E, A>(either: Either<E, A>): either is Right<A> {
  return either._tag === "Right";
}

// ---------------------------------------------------------------------------
// DomainAdapter — the contract every domain must fulfill
// ---------------------------------------------------------------------------

/**
 * The contract between the domain-agnostic evolution framework and a specific domain.
 *
 * Each domain (BI, forms, workflows, etc.) provides its own implementation.
 * The framework calls these methods during pipeline execution but never
 * interprets the domain-specific content they operate on.
 *
 * Method signatures reflect the Current/Candidate distinction:
 * - `compile` returns Either (deterministic, trusted Schema)
 * - `compileC` returns CompileResult (three-way, runtime uncertainty)
 */
export interface DomainAdapter {
  /**
   * Compile a trusted Instance into an Executable.
   *
   * Deterministic. The Instance has already been validated against a promoted
   * Schema, so compilation should only fail due to bugs (not design issues).
   */
  compile(instance: Instance): Either<CompileError, Executable>;

  /**
   * Compile a CandidateInstance against the current runtime.
   *
   * Returns Compiled (success), Blocked (runtime can't support), or
   * Degraded (partially executable with missing features).
   *
   * Blocked constraints feed back into Extend as epistemological feedback.
   * Degraded constraints produce RuntimeUpdateTasks for engineers.
   */
  compileC(candidate: CandidateInstance): CompileResult;

  /**
   * Execute a compiled artifact, producing observable Behavior.
   *
   * Deterministic. The same Executable should always produce the same Behavior.
   */
  execute(executable: Executable): Either<ExecuteError, Behavior>;

  /**
   * Extract a Behavior fingerprint from raw expert output.
   *
   * This bridges the gap between OpaqueSource (what the expert produced)
   * and Behavior (what the system can compare). The domain decides which
   * dimensions matter for comparison.
   */
  fingerprint(raw: unknown): Behavior;

  /**
   * Declare what the current runtime environment can execute.
   *
   * Called by CompileC to determine whether a CandidateInstance's required
   * features are Supported, Feasible, or Unfeasible.
   */
  runtime(): RuntimeCapability;

  /**
   * Validate a trusted Instance against a Schema.
   *
   * The domain layer owns the structural knowledge (fields, rules, types)
   * and performs the actual validation. Returns [] if the instance is valid.
   */
  validate(schema: Schema, instance: Instance): ReadonlyArray<ValidationError>;

  /**
   * Validate a CandidateInstance against a CandidateSchema.
   *
   * Validates base payload against the base schema and extension payload
   * against the extension fields. Returns [] if the candidate is valid.
   */
  validateCandidate(
    candidateSchema: CandidateSchema,
    candidate: CandidateInstance,
  ): ReadonlyArray<ValidationError>;

  /**
   * Materialize a CandidateSchema's extensions into a new flat Schema.
   *
   * The domain layer knows how to merge base + extensions into a concrete
   * Schema. The result is the fully-realized trusted Schema for the new version.
   */
  materialize(
    base: Schema,
    extensions: ReadonlyArray<Extension>,
    newVersion: string,
  ): Schema;
}
