/**
 * Extend action — Schema + Gap + Demonstration → Extension + CandidateInstance.
 *
 * Non-deterministic (AI-driven). The Extend action proposes a Schema extension
 * that bridges a Gap between the current Schema and expert behavior. It produces
 * both the Extension (what to add to the Schema) and a CandidateInstance
 * (how to express the demonstration using the extended Schema).
 *
 * The framework defines the interface; each domain provides its own
 * implementation with domain-specific prompt strategies.
 */

import type { Schema, Extension } from "../types/schema.js";
import type { CandidateInstance } from "../types/instance.js";
import type { Demonstration } from "../types/demonstration.js";
import type { Gap } from "../types/gap.js";
import type { ExtendError } from "../types/errors.js";
import type { Either } from "../adapter.js";

/**
 * The result of a successful Extend action.
 *
 * Contains both the proposed Extension (schema addition) and the
 * CandidateInstance (data split into base + extension payloads).
 */
export interface ExtendResult {
  readonly extension: Extension;
  readonly candidateInstance: CandidateInstance;
}

/**
 * The contract for the Extend action.
 *
 * Given a Schema, a Gap (what's missing), a Demonstration (what the expert did),
 * and any previously tried extensions, propose a new Extension that bridges
 * the Gap.
 *
 * The existingExtensions parameter lets the implementation know what has already
 * been attempted in prior iterations, so it can try a different approach.
 */
export interface ExtendAction {
  extend(
    schema: Schema,
    gap: Gap,
    demonstration: Demonstration,
    existingExtensions: ReadonlyArray<Extension>,
  ): Promise<Either<ExtendError, ExtendResult>>;
}
