/**
 * Workbench types — interfaces for the framework-provided training UI.
 *
 * These types define the contract between the workbench UI and the
 * domain/infrastructure layer. The workbench is domain-agnostic;
 * it receives everything it needs through these interfaces.
 */

import type { ReactNode } from "react";
import type { DomainAdapter } from "../adapter.js";
import type { Schema, CandidateSchema } from "../types/schema.js";
import type { Demonstration } from "../types/demonstration.js";
import type { Gap } from "../types/gap.js";
import type { Stage, ApproxOutcome, ExtensionOutcome } from "../types/pipeline.js";
import type { SchemaRegistry } from "../schema-registry.js";

// ---------------------------------------------------------------------------
// Panel identifiers
// ---------------------------------------------------------------------------

export type PanelId =
  | "demos"
  | "playground"
  | "training"
  | "boundary"
  | "versions";

// ---------------------------------------------------------------------------
// Preview — domain-provided rendering for behaviors
// ---------------------------------------------------------------------------

export interface PreviewConfig {
  readonly type: "html" | "json" | "iframe" | "image" | "custom";
  readonly content: string | Record<string, unknown>;
  readonly component?: React.ComponentType<{ data: unknown }>;
}

export interface PreviewCapability {
  renderBehavior(behavior: Record<string, unknown>): PreviewConfig;
  renderInstance(payload: Record<string, unknown>): PreviewConfig;
}

// ---------------------------------------------------------------------------
// WorkbenchAdapter — DomainAdapter extended with optional preview
// ---------------------------------------------------------------------------

export type WorkbenchAdapter = DomainAdapter & {
  preview?: PreviewCapability;
};

// ---------------------------------------------------------------------------
// Log lines — for the terminal viewer
// ---------------------------------------------------------------------------

export interface LogLine {
  readonly timestamp: number;
  readonly level: "info" | "warn" | "error" | "debug";
  readonly stage?: Stage;
  readonly message: string;
  readonly data?: unknown;
}

// ---------------------------------------------------------------------------
// Pipeline events — engine → UI communication
// ---------------------------------------------------------------------------

export type PipelineEvent =
  | { kind: "pipeline:start"; phase: "approximation" | "extension" }
  | { kind: "stage:enter"; stage: Stage }
  | { kind: "stage:complete"; stage: Stage; durationMs: number }
  | { kind: "stage:error"; stage: Stage; error: string }
  | { kind: "log"; line: LogLine }
  | { kind: "approximation:result"; outcome: ApproxOutcome }
  | { kind: "extension:iteration"; iteration: number; maxIterations: number }
  | { kind: "extension:result"; outcome: ExtensionOutcome }
  | { kind: "pipeline:complete"; durationMs: number };

export type PipelineEventListener = (event: PipelineEvent) => void;

// ---------------------------------------------------------------------------
// DiffViewData — 3-column comparison for TrainingGround
// ---------------------------------------------------------------------------

export interface DiffViewData {
  readonly expert: Record<string, unknown>;
  readonly system: Record<string, unknown>;
  readonly gap: Gap;
}

// ---------------------------------------------------------------------------
// EvolutionEngine — wraps pipelines with event emission
// ---------------------------------------------------------------------------

export interface EvolutionEngine {
  /**
   * Run approximation + extension (without auto-promote).
   * Emits PipelineEvents throughout execution.
   */
  runEvolution(demonstration: Demonstration): Promise<EvolutionRunResult>;

  /**
   * Run approximation only (playground mode).
   */
  runApproximation(demonstration: Demonstration): Promise<ApproxOutcome>;

  /** Subscribe to pipeline events. Returns unsubscribe function. */
  subscribe(listener: PipelineEventListener): () => void;
}

export type EvolutionRunResult =
  | { kind: "assimilated"; outcome: ApproxOutcome }
  | { kind: "converged"; approxOutcome: ApproxOutcome; extOutcome: ExtensionOutcome }
  | { kind: "diverged"; approxOutcome: ApproxOutcome; extOutcome: ExtensionOutcome }
  | { kind: "failed"; stage: Stage; message: string };

// ---------------------------------------------------------------------------
// DemoStore — persistence layer for demonstrations
// ---------------------------------------------------------------------------

export interface DemoStore {
  list(): Demonstration[];
  get(id: string): Demonstration | undefined;
  add(demo: Demonstration): void;
  remove(id: string): void;
}

// ---------------------------------------------------------------------------
// WorkbenchProps — the root component's props
// ---------------------------------------------------------------------------

export interface WorkbenchProps {
  readonly adapter: WorkbenchAdapter;
  readonly registry: SchemaRegistry;
  readonly engine: EvolutionEngine;
  readonly demoStore: DemoStore;
}
