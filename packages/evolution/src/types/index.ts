// Type barrel exports — all public types from @evolution/core

// Schema
export type {
  Schema,
  CandidateSchema,
  Extension,
} from "./schema.js";

// Instance
export type { Instance, CandidateInstance, Payload } from "./instance.js";

// Demonstration
export type { Demonstration, Behavior, OpaqueSource } from "./demonstration.js";

// Gap
export type { Gap, Discrepancy } from "./gap.js";
export { Severity, DiscrepancyType, GapSource } from "./gap.js";

// Runtime
export type { RuntimeCapability, Feature, RuntimeUpdateTask } from "./runtime.js";
export { Supportability } from "./runtime.js";

// Compile
export type {
  Executable,
  CompileResult,
  CompiledResult,
  BlockedResult,
  DegradedResult,
  Constraint,
} from "./compile.js";

// Memory
export type { Memory, EvolutionRecord } from "./memory.js";
export { EvolutionOutcome } from "./memory.js";

// Pipeline
export type {
  ApproxOutcome,
  Sufficient,
  Insufficient,
  ExtensionOutcome,
  Converged,
  Diverged,
  EvolutionResult,
  Evolved,
  Assimilated,
  Escalated,
  PipelineFailed,
  ConvergenceConfig,
} from "./pipeline.js";
export { Stage } from "./pipeline.js";

// Errors
export type {
  ValidationError,
  CompileError,
  ExecuteError,
  ApproximateError,
  ExtendError,
  PromoteError,
  EvolutionError,
  PipelineError,
} from "./errors.js";
