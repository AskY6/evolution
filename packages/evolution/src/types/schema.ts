/**
 * Schema types — the knowledge framework (identity only).
 *
 * The framework holds only identity information for a Schema. Structural
 * definitions (fields, rules, type vocabulary) are domain concerns and live
 * in the domain layer (e.g. apps/workbench/src/bi/types.ts).
 *
 * Domains extend Schema/Extension structurally (TypeScript duck typing):
 *   BiSchema  ⊇ Schema  (adds fields + rules)
 *   BiExtension ⊇ Extension (adds newFields + newRules)
 *
 * The DomainAdapter receives the base types and casts to its own richer types
 * internally. This keeps the framework domain-agnostic.
 */

// ---------------------------------------------------------------------------
// Schema — trusted, stable knowledge framework (identity only)
// ---------------------------------------------------------------------------

/**
 * A trusted, stable knowledge framework.
 *
 * The framework only needs identity (id + version). Structural content
 * (fields, rules, etc.) is defined and owned by the domain layer.
 * Users always operate against a promoted Schema — never a Candidate.
 */
export interface Schema {
  readonly id: string;
  readonly version: string;
}

// ---------------------------------------------------------------------------
// Extension — an opaque addition to a Schema
// ---------------------------------------------------------------------------

/**
 * A minimal, atomic extension to a Schema — one new concept or capability.
 *
 * The framework only stores the extension's identity and description.
 * The domain layer extends this with domain-specific structural content
 * (e.g. BiExtension adds newFields/newRules). At runtime the domain adapter
 * receives the full object and casts to its richer type.
 */
export interface Extension {
  readonly id: string;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// CandidateSchema — provisional, always rollback-able
// ---------------------------------------------------------------------------

/**
 * A provisional schema that "grows out of" a trusted base.
 *
 * CandidateSchema is not an independent framework — it is always defined
 * relative to a specific baseSchema plus a set of extensions. This means:
 * - You can always answer "what changed relative to what baseline?"
 * - You can always rollback by discarding the extensions.
 */
export interface CandidateSchema {
  readonly baseSchema: Schema;
  readonly extensions: ReadonlyArray<Extension>;
}
