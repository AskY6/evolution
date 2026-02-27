// @evolution/core — Domain-agnostic evolution framework
// "How learning happens"

// Core types
export * from "./types/index.js";

// DomainAdapter interface and Either utilities
export type { DomainAdapter, Either, Left, Right } from "./adapter.js";
export { left, right, isLeft, isRight } from "./adapter.js";

// DemonstrationSource interface
export type { DemonstrationSource } from "./observer.js";

// Validator
export { validateInstance, validateCandidateInstance } from "./validator.js";

// Comparator
export { compare, isEquivalent } from "./comparator.js";

// Schema Registry
export { SchemaRegistry, materialize } from "./schema-registry.js";

// Actions
export type { ApproximateAction } from "./actions/index.js";
