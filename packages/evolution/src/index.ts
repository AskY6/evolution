// @evolution/core — Domain-agnostic evolution framework
// "How learning happens"

// Core types
export * from "./types/index.js";

// DomainAdapter interface and Either utilities
export type { DomainAdapter, Either, Left, Right } from "./adapter.js";
export { left, right, isLeft, isRight } from "./adapter.js";

// DemonstrationSource interface
export type { DemonstrationSource } from "./observer.js";

// Comparator
export { compare, isEquivalent } from "./comparator.js";

// Schema Registry
export { SchemaRegistry } from "./schema-registry.js";

// Actions
export type { ApproximateAction } from "./actions/index.js";
export type { ExtendAction, ExtendResult } from "./actions/index.js";

// Pipelines
export {
  runApproximation,
  SEVERITY_ORDINAL,
  type ApproximationInput,
  type ApproximationResult,
  type ApproximationConfig,
} from "./pipelines/index.js";

export {
  runExtension,
  constraintsToGap,
  type ExtensionInput,
  type ExtensionResult,
} from "./pipelines/index.js";

export {
  runCodification,
  type CodificationInput,
} from "./pipelines/index.js";

export {
  runEvolution,
  type EvolutionInput,
} from "./pipelines/index.js";

// Reporter
export {
  generateCaseReport,
  formatCaseReport,
  buildCaseFiles,
  type CaseReport,
} from "./reporter.js";
