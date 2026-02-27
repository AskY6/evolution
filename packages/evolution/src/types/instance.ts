/**
 * Instance types — concrete expressions of a Schema.
 *
 * An Instance is a specific "utterance" in the Schema's language.
 * A CandidateInstance splits its content into what the current Schema
 * can express (base) and what requires new concepts (extension).
 */

// ---------------------------------------------------------------------------
// Payload — the data an Instance carries
// ---------------------------------------------------------------------------

/**
 * Opaque payload data whose structure is defined by a Schema.
 *
 * The framework validator checks that a Payload conforms to the Schema's
 * FieldDefinitions. The domain adapter interprets the semantic meaning.
 */
export type Payload = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Instance — fully expressible in the current Schema
// ---------------------------------------------------------------------------

/**
 * A concrete instance whose every field is defined by the current Schema.
 *
 * Instances live in the "Current" world — they are trusted, stable, and
 * always pass validation against their Schema. The deterministic pipeline
 * (Validate → Compile → Execute) operates exclusively on Instances.
 */
export interface Instance {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly payload: Payload;
}

// ---------------------------------------------------------------------------
// CandidateInstance — partially beyond the current Schema
// ---------------------------------------------------------------------------

/**
 * A provisional instance that requires Schema extensions to be fully expressed.
 *
 * The split into basePayload and extensionPayload serves two purposes:
 * 1. During Extension: the framework knows exactly which parts are new.
 * 2. During Promote: basePayload is already stable; only extensionPayload
 *    needs migration into the new Schema's structure.
 */
export interface CandidateInstance {
  /** The base Schema this candidate is built upon. */
  readonly schemaId: string;
  readonly schemaVersion: string;
  /** The portion expressible under the current Schema. */
  readonly basePayload: Payload;
  /** The portion requiring CandidateSchema extensions. */
  readonly extensionPayload: Payload;
}
