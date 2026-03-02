/**
 * Evolution pipeline — full orchestration.
 *
 * Composes the three sub-pipelines:
 * 1. Approximation: Can the current Schema express the demonstration?
 *    - Sufficient → Assimilated (no change needed)
 *    - Insufficient → continue to Extension
 * 2. Extension: Iteratively extend the Schema to bridge the gap
 *    - Converged → continue to Codification
 *    - Diverged → Escalated (needs human review)
 * 3. Codification: Promote the CandidateSchema into Memory
 *    - Success → Evolved
 *    - Failure → PipelineFailed
 */

import type { Demonstration } from "../types/demonstration.js";
import type { Memory } from "../types/memory.js";
import type { ConvergenceConfig, EvolutionResult } from "../types/pipeline.js";
import { Stage } from "../types/pipeline.js";
import type { DomainAdapter } from "../adapter.js";
import { isLeft } from "../adapter.js";
import type { ApproximateAction } from "../actions/approximate.js";
import type { ExtendAction } from "../actions/extend.js";
import { runApproximation } from "./approximation.js";
import { runExtension } from "./extension.js";
import { runCodification } from "./codification.js";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Input to the full Evolution pipeline. */
export interface EvolutionInput {
  readonly memory: Memory;
  readonly demonstration: Demonstration;
  readonly adapter: DomainAdapter;
  readonly approximateAction: ApproximateAction;
  readonly extendAction: ExtendAction;
  readonly convergenceConfig: ConvergenceConfig;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the full Evolution pipeline.
 *
 * 1. Approximation → Sufficient → Assimilated
 * 2. → Insufficient → Extension → Converged → Codification → Evolved
 * 3. → Diverged → Escalated
 * 4. Any failure → PipelineFailed
 */
export async function runEvolution(
  input: EvolutionInput,
): Promise<EvolutionResult> {
  const { memory, demonstration, adapter, approximateAction, extendAction, convergenceConfig } = input;
  const schema = memory.currentSchema;

  // Phase A: Approximation
  const approxResult = await runApproximation({
    schema,
    demonstration,
    adapter,
    approximateAction,
  });

  if (approxResult.kind === "failed") {
    return approxResult;
  }

  if (approxResult.kind === "sufficient") {
    return {
      kind: "assimilated",
      instance: approxResult.instance,
    };
  }

  // Phase B: Extension (approxResult.kind === "insufficient")
  const extensionResult = await runExtension({
    schema,
    gap: approxResult.gap,
    demonstration,
    adapter,
    extendAction,
    config: convergenceConfig,
  });

  if (extensionResult.kind === "failed") {
    return extensionResult;
  }

  if (extensionResult.kind === "diverged") {
    return {
      kind: "escalated",
      iterations: extensionResult.iterations,
      lastGap: extensionResult.lastGap,
    };
  }

  // Phase C: Codification (extensionResult.kind === "converged")
  const codifyResult = runCodification({
    memory,
    candidateSchema: extensionResult.candidateSchema,
    candidateInstance: extensionResult.candidateInstance,
    demonstrationId: demonstration.id,
    gap: approxResult.gap,
    iterations: extensionResult.iterations,
    adapter,
  });

  if (isLeft(codifyResult)) {
    return {
      kind: "failed",
      stage: Stage.Promote,
      message: codifyResult.left.message,
      cause: codifyResult.left,
    };
  }

  return {
    kind: "evolved",
    newSchema: codifyResult.right.currentSchema,
    iterations: extensionResult.iterations,
  };
}
