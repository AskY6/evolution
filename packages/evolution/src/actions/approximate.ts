/**
 * Approximate action — Schema + Demonstration → Instance.
 *
 * Non-deterministic (AI-driven). The Approximate action attempts to express
 * an expert's demonstrated behavior using the current Schema. It produces
 * the "best effort" Instance, which may not fully capture the behavior
 * (that's what the Gap reveals).
 *
 * The framework defines the interface; each domain provides its own
 * implementation with domain-specific prompt strategies.
 */

import type { Schema } from "../types/schema.js";
import type { Instance } from "../types/instance.js";
import type { Demonstration } from "../types/demonstration.js";
import type { ApproximateError } from "../types/errors.js";
import type { Either } from "../adapter.js";

/**
 * The contract for the Approximate action.
 *
 * Given a Schema (the current cognitive framework) and a Demonstration
 * (what the expert did), produce an Instance that best approximates the
 * behavior within the Schema's vocabulary.
 *
 * This is inherently non-deterministic — implementations typically use
 * an LLM to interpret the demonstration and produce structured output.
 */
export interface ApproximateAction {
  approximate(
    schema: Schema,
    demonstration: Demonstration,
  ): Promise<Either<ApproximateError, Instance>>;
}
