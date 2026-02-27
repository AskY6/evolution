/**
 * SchemaRegistry — load, promote, rollback.
 *
 * Minimal versioned store for Schemas. Tracks the current (active) schema
 * and maintains a history of all versions for rollback support.
 *
 * Promote merges a CandidateSchema's extensions into a new Schema version.
 * Rollback restores a previous version as current.
 *
 * In-memory implementation — can be backed by persistent storage later.
 */

import type { Schema, CandidateSchema, Extension, FieldDefinition, Rule } from "./types/schema.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class SchemaRegistry {
  private schemas: Map<string, Schema> = new Map();
  private currentId: string | null = null;

  /** Load (register) a schema into the registry. */
  load(schema: Schema): void {
    const key = versionKey(schema.id, schema.version);
    this.schemas.set(key, schema);
    // First loaded schema becomes current if none set
    if (this.currentId === null) {
      this.currentId = key;
    }
  }

  /** Get a specific schema by id and version. Returns undefined if not found. */
  get(id: string, version: string): Schema | undefined {
    return this.schemas.get(versionKey(id, version));
  }

  /** Get the current (active) schema. Throws if registry is empty. */
  current(): Schema {
    if (this.currentId === null) {
      throw new Error("SchemaRegistry is empty — no schema has been loaded.");
    }
    const schema = this.schemas.get(this.currentId);
    if (!schema) {
      throw new Error(`Current schema "${this.currentId}" not found in registry.`);
    }
    return schema;
  }

  /**
   * Promote a CandidateSchema to a new trusted Schema version.
   *
   * Merges the base schema's fields/rules with all extension fields/rules.
   * The result becomes the new current schema.
   *
   * @param candidate   - The CandidateSchema to promote.
   * @param newVersion  - The version string for the promoted schema.
   * @returns The newly created Schema.
   */
  promote(candidate: CandidateSchema, newVersion: string): Schema {
    const base = candidate.baseSchema;

    const promoted: Schema = materialize(base, candidate.extensions, newVersion);

    this.load(promoted);
    this.currentId = versionKey(promoted.id, promoted.version);

    return promoted;
  }

  /**
   * Rollback to a previously loaded schema version, making it current.
   *
   * @throws If the specified version is not found in the registry.
   */
  rollback(id: string, version: string): Schema {
    const key = versionKey(id, version);
    const schema = this.schemas.get(key);
    if (!schema) {
      throw new Error(`Cannot rollback: schema "${key}" not found in registry.`);
    }
    this.currentId = key;
    return schema;
  }

  /** List all schema versions in the registry, ordered by insertion. */
  history(): ReadonlyArray<Schema> {
    return [...this.schemas.values()];
  }

  /** Check if the registry contains any schemas. */
  isEmpty(): boolean {
    return this.schemas.size === 0;
  }
}

// ---------------------------------------------------------------------------
// Materialization — CandidateSchema → Schema
// ---------------------------------------------------------------------------

/**
 * Materialize a CandidateSchema into a flat Schema.
 *
 * Extensions only add fields and rules — they never remove or modify
 * existing ones (backward compatibility guarantee). The materialized
 * schema contains all base fields + extension fields, all base rules +
 * extension rules.
 */
export function materialize(
  base: Schema,
  extensions: ReadonlyArray<Extension>,
  newVersion: string,
): Schema {
  const allNewFields: FieldDefinition[] = [];
  const allNewRules: Rule[] = [];

  for (const ext of extensions) {
    allNewFields.push(...ext.newFields);
    allNewRules.push(...ext.newRules);
  }

  return {
    id: base.id,
    version: newVersion,
    fields: [...base.fields, ...allNewFields],
    rules: [...base.rules, ...allNewRules],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function versionKey(id: string, version: string): string {
  return `${id}@${version}`;
}
