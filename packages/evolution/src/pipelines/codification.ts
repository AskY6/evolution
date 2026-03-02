/**
 * Codification pipeline — Promote a converged CandidateSchema into Memory.
 *
 * After the Extension pipeline converges, this pipeline:
 * 1. Materializes the CandidateSchema extensions into a new Schema version
 * 2. Creates an EvolutionRecord documenting the change
 * 3. Returns updated Memory atomically
 *
 * This is the only path through which Memory changes.
 */

import type { Schema, CandidateSchema } from "../types/schema.js";
import type { CandidateInstance } from "../types/instance.js";
import type { Memory, EvolutionRecord } from "../types/memory.js";
import { EvolutionOutcome } from "../types/memory.js";
import type { Gap } from "../types/gap.js";
import type { PromoteError } from "../types/errors.js";
import type { DomainAdapter, Either } from "../adapter.js";
import { left, right } from "../adapter.js";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Input to the Codification pipeline. */
export interface CodificationInput {
  readonly memory: Memory;
  readonly candidateSchema: CandidateSchema;
  readonly candidateInstance: CandidateInstance;
  readonly demonstrationId: string;
  readonly gap: Gap;
  readonly iterations: number;
  readonly adapter: DomainAdapter;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Promote a converged CandidateSchema into Memory.
 *
 * - Materializes extensions into a new Schema (minor version bump)
 * - Creates an EvolutionRecord
 * - Returns updated Memory with new schema as current
 */
export function runCodification(
  input: CodificationInput,
): Either<PromoteError, Memory> {
  const { memory, candidateSchema, demonstrationId, gap, iterations, adapter } = input;

  try {
    const fromVersion = memory.currentSchema.version;
    const newVersion = bumpMinorVersion(fromVersion);

    // Materialize: domain adapter merges extensions into a new flat Schema
    const newSchema: Schema = adapter.materialize(
      candidateSchema.baseSchema,
      candidateSchema.extensions,
      newVersion,
    );

    // Create evolution record
    const record: EvolutionRecord = {
      id: `evo-${Date.now()}`,
      timestamp: new Date().toISOString(),
      demonstrationId,
      outcome: EvolutionOutcome.Success,
      fromSchemaVersion: fromVersion,
      toSchemaVersion: newVersion,
      gap,
      iterations,
      summary: `Schema extended from ${fromVersion} to ${newVersion} after ${iterations} iteration(s).`,
    };

    // Assemble updated Memory atomically
    const updatedMemory: Memory = {
      currentSchema: newSchema,
      schemaHistory: [...memory.schemaHistory, newSchema],
      records: [...memory.records, record],
    };

    return right(updatedMemory);
  } catch (err) {
    return left({
      kind: "promote",
      message: err instanceof Error ? err.message : String(err),
      details: err,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Bump the minor version: 0.1.0 → 0.2.0, 1.3.5 → 1.4.0
 */
function bumpMinorVersion(version: string): string {
  const parts = version.split(".");
  if (parts.length !== 3) {
    return `${version}.1`;
  }
  const [major, minor] = parts;
  return `${major}.${parseInt(minor, 10) + 1}.0`;
}
