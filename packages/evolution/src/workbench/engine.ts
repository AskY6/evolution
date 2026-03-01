/**
 * EvolutionEngine — wraps pipeline functions with event emission.
 *
 * The engine calls runApproximation + runExtension directly (not runEvolution)
 * to insert event hooks between phases and skip auto-codification.
 * Promote is an explicit user action via registry.promote().
 */

import type { Schema } from "../types/schema.js";
import type { Demonstration } from "../types/demonstration.js";
import type { ApproxOutcome } from "../types/pipeline.js";
import { Stage } from "../types/pipeline.js";
import type { DomainAdapter } from "../adapter.js";
import type { ApproximateAction } from "../actions/approximate.js";
import type { ExtendAction } from "../actions/extend.js";
import type { ConvergenceConfig } from "../types/pipeline.js";
import { runApproximation as runApprox } from "../pipelines/approximation.js";
import { runExtension as runExt } from "../pipelines/extension.js";
import type {
  EvolutionEngine,
  EvolutionRunResult,
  PipelineEvent,
  PipelineEventListener,
  LogLine,
} from "./types.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface EngineConfig {
  readonly schema: () => Schema;
  readonly adapter: DomainAdapter;
  readonly approximateAction: ApproximateAction;
  readonly extendAction: ExtendAction;
  readonly convergenceConfig: ConvergenceConfig;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEvolutionEngine(config: EngineConfig): EvolutionEngine {
  const listeners = new Set<PipelineEventListener>();

  function emit(event: PipelineEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function log(
    level: LogLine["level"],
    message: string,
    stage?: Stage,
    data?: unknown,
  ): void {
    const line: LogLine = { timestamp: Date.now(), level, message, stage, data };
    emit({ kind: "log", line });
  }

  return {
    async runEvolution(demonstration: Demonstration): Promise<EvolutionRunResult> {
      const start = Date.now();
      const schema = config.schema();

      // Phase A: Approximation
      emit({ kind: "pipeline:start", phase: "approximation" });
      log("info", "Starting approximation pipeline", Stage.Approximate);

      emit({ kind: "stage:enter", stage: Stage.Approximate });
      const approxStart = Date.now();

      const approxResult = await runApprox({
        schema,
        demonstration,
        adapter: config.adapter,
        approximateAction: config.approximateAction,
      });

      emit({
        kind: "stage:complete",
        stage: Stage.Approximate,
        durationMs: Date.now() - approxStart,
      });

      if (approxResult.kind === "failed") {
        log("error", `Approximation failed at ${approxResult.stage}: ${approxResult.message}`, approxResult.stage);
        emit({ kind: "stage:error", stage: approxResult.stage, error: approxResult.message });
        emit({ kind: "pipeline:complete", durationMs: Date.now() - start });
        return { kind: "failed", stage: approxResult.stage, message: approxResult.message };
      }

      emit({ kind: "approximation:result", outcome: approxResult });

      if (approxResult.kind === "sufficient") {
        log("info", "Schema is sufficient — no extension needed", Stage.Compare);
        emit({ kind: "pipeline:complete", durationMs: Date.now() - start });
        return { kind: "assimilated", outcome: approxResult };
      }

      // Phase B: Extension
      log("info", `Gap detected (${approxResult.gap.severity}), starting extension`, Stage.Extend);
      emit({ kind: "pipeline:start", phase: "extension" });
      emit({ kind: "stage:enter", stage: Stage.Extend });
      const extStart = Date.now();

      const extResult = await runExt({
        schema,
        gap: approxResult.gap,
        demonstration,
        adapter: config.adapter,
        extendAction: config.extendAction,
        config: config.convergenceConfig,
      });

      emit({
        kind: "stage:complete",
        stage: Stage.Extend,
        durationMs: Date.now() - extStart,
      });

      if (extResult.kind === "failed") {
        log("error", `Extension failed at ${extResult.stage}: ${extResult.message}`, extResult.stage);
        emit({ kind: "stage:error", stage: extResult.stage, error: extResult.message });
        emit({ kind: "pipeline:complete", durationMs: Date.now() - start });
        return { kind: "failed", stage: extResult.stage, message: extResult.message };
      }

      emit({ kind: "extension:result", outcome: extResult });

      if (extResult.kind === "converged") {
        log("info", `Extension converged after ${extResult.iterations} iteration(s)`, Stage.Extend);
        emit({ kind: "pipeline:complete", durationMs: Date.now() - start });
        return { kind: "converged", approxOutcome: approxResult, extOutcome: extResult };
      }

      // Diverged
      log("warn", `Extension diverged after ${extResult.iterations} iteration(s)`, Stage.Extend);
      emit({ kind: "pipeline:complete", durationMs: Date.now() - start });
      return { kind: "diverged", approxOutcome: approxResult, extOutcome: extResult };
    },

    async runApproximation(demonstration: Demonstration): Promise<ApproxOutcome> {
      const schema = config.schema();
      log("info", "Running approximation (playground mode)", Stage.Approximate);

      const result = await runApprox({
        schema,
        demonstration,
        adapter: config.adapter,
        approximateAction: config.approximateAction,
      });

      if (result.kind === "failed") {
        throw new Error(`Approximation failed at ${result.stage}: ${result.message}`);
      }

      return result;
    },

    subscribe(listener: PipelineEventListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
