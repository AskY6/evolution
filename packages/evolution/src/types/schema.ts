/**
 * Schema types — the knowledge framework.
 *
 * A Schema is the trusted, stable cognitive framework that defines what Instances
 * can express. It is the basis for all validation and the "language" the system
 * uses to understand expert behavior.
 *
 * The Schema carries enough structural information for the domain-agnostic
 * validator to check Instance conformance without domain-specific knowledge.
 */

// ---------------------------------------------------------------------------
// FieldType — recursive type descriptor for Schema fields
// ---------------------------------------------------------------------------

/** Leaf type: string with optional constraints. */
export interface StringType {
  readonly kind: "string";
  readonly enum?: ReadonlyArray<string>;
}

/** Leaf type: number with optional range. */
export interface NumberType {
  readonly kind: "number";
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

/** Leaf type: boolean. */
export interface BooleanType {
  readonly kind: "boolean";
}

/** Composite type: nested object with its own fields. */
export interface ObjectType {
  readonly kind: "object";
  readonly fields: ReadonlyArray<FieldDefinition>;
}

/** Collection type: ordered list of a single element type. */
export interface ArrayType {
  readonly kind: "array";
  readonly element: FieldType;
  readonly minItems?: number;
  readonly maxItems?: number;
}

/** Union type: value must conform to exactly one of the variants. */
export interface UnionType {
  readonly kind: "union";
  readonly variants: ReadonlyArray<FieldType>;
}

/** All possible field type descriptors. */
export type FieldType =
  | StringType
  | NumberType
  | BooleanType
  | ObjectType
  | ArrayType
  | UnionType;

// ---------------------------------------------------------------------------
// FieldDefinition — a named, typed slot in a Schema
// ---------------------------------------------------------------------------

/** A single field that an Instance payload may (or must) contain. */
export interface FieldDefinition {
  readonly name: string;
  readonly description: string;
  readonly type: FieldType;
  readonly required: boolean;
  /** Default value when the field is omitted from a payload. */
  readonly defaultValue?: unknown;
}

// ---------------------------------------------------------------------------
// Rule — constraint on valid field combinations
// ---------------------------------------------------------------------------

/**
 * A declarative constraint on how field values relate to each other.
 * The validator evaluates these without domain knowledge.
 */
export type Rule =
  | RequiredIfRule
  | MutualExclusiveRule
  | DependsOnRule;

/** Field A is required when field B has a specific value. */
export interface RequiredIfRule {
  readonly kind: "required_if";
  readonly field: string;
  readonly when: { readonly field: string; readonly equals: unknown };
}

/** At most one of these fields may be present. */
export interface MutualExclusiveRule {
  readonly kind: "mutual_exclusive";
  readonly fields: ReadonlyArray<string>;
}

/** Field A can only be present when field B is also present. */
export interface DependsOnRule {
  readonly kind: "depends_on";
  readonly field: string;
  readonly requires: string;
}

// ---------------------------------------------------------------------------
// Schema — trusted, stable knowledge framework
// ---------------------------------------------------------------------------

/**
 * A trusted, stable knowledge framework.
 *
 * Every Instance is validated against a Schema. The Schema defines the
 * vocabulary (fields) and grammar (rules) that constrain valid Instances.
 * Users always operate against a promoted Schema — never a Candidate.
 */
export interface Schema {
  readonly id: string;
  readonly version: string;
  readonly fields: ReadonlyArray<FieldDefinition>;
  readonly rules: ReadonlyArray<Rule>;
}

// ---------------------------------------------------------------------------
// Extension — a minimal addition to a Schema
// ---------------------------------------------------------------------------

/**
 * A minimal, atomic extension to a Schema — one new concept or capability.
 *
 * An Extension only adds; it never removes or modifies existing fields/rules.
 * This guarantees backward compatibility: any Instance valid under the base
 * Schema remains valid after the extension is applied.
 */
export interface Extension {
  readonly id: string;
  readonly description: string;
  readonly newFields: ReadonlyArray<FieldDefinition>;
  readonly newRules: ReadonlyArray<Rule>;
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
