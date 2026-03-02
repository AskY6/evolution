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

import type { Schema } from "./types/schema.js";

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
   * Register an already-materialized Schema as the current version.
   *
   * The caller is responsible for materializing the schema (via
   * DomainAdapter.materialize) before calling promote. This method
   * only registers and activates the schema.
   *
   * @param schema - The already-materialized Schema to promote.
   * @returns The promoted Schema.
   */
  promote(schema: Schema): Schema {
    this.load(schema);
    this.currentId = versionKey(schema.id, schema.version);
    return schema;
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
// Helpers
// ---------------------------------------------------------------------------

function versionKey(id: string, version: string): string {
  return `${id}@${version}`;
}
