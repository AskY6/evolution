/**
 * Error types — all domain-agnostic errors in the evolution framework.
 *
 * Each error is a plain object with a `kind` discriminator, making them
 * safe to serialize and transport across process boundaries.
 */

import type { Stage } from "./pipeline.js";

// ---------------------------------------------------------------------------
// Per-stage error types
// ---------------------------------------------------------------------------

/** Error during Schema or Instance validation. */
export interface ValidationError {
  readonly kind: "validation";
  /** Dot-notation path to the invalid field (e.g. "payload.chartType"). */
  readonly path: string;
  readonly message: string;
  /** The value that failed validation, if available. */
  readonly value?: unknown;
}

/** Error during deterministic compilation (Instance → Executable). */
export interface CompileError {
  readonly kind: "compile";
  readonly message: string;
  readonly details?: unknown;
}

/** Error during execution (Executable → Behavior). */
export interface ExecuteError {
  readonly kind: "execute";
  readonly message: string;
  readonly details?: unknown;
}

/** Error during approximation (AI-driven: Schema + Demo → Instance). */
export interface ApproximateError {
  readonly kind: "approximate";
  readonly message: string;
  /** The raw LLM response that couldn't be parsed, if available. */
  readonly rawOutput?: string;
}

/** Error during extension (AI-driven: Schema + Gap + Demo → Candidate). */
export interface ExtendError {
  readonly kind: "extend";
  readonly message: string;
  /** Which iteration of the extension loop failed. */
  readonly iteration: number;
  readonly rawOutput?: string;
}

/** Error during schema promotion (Candidate → promoted Schema). */
export interface PromoteError {
  readonly kind: "promote";
  readonly message: string;
  readonly details?: unknown;
}

// ---------------------------------------------------------------------------
// Aggregate error type
// ---------------------------------------------------------------------------

/** Union of all domain-agnostic error types. */
export type EvolutionError =
  | ValidationError
  | CompileError
  | ExecuteError
  | ApproximateError
  | ExtendError
  | PromoteError;

// ---------------------------------------------------------------------------
// Pipeline error — wraps any error with stage context
// ---------------------------------------------------------------------------

/** A pipeline-level error with stage context, for tracing and reporting. */
export interface PipelineError {
  readonly stage: Stage;
  readonly error: EvolutionError;
}
