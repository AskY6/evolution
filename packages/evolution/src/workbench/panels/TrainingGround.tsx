import type { Demonstration } from "../../types/index.js";
import type { PipelineState } from "../hooks/usePipeline.js";
import type { SchemaRegistryState } from "../hooks/useSchemaRegistry.js";
import type { DemosState } from "../hooks/useDemos.js";
import type { DiffViewData, PreviewCapability } from "../types.js";
import { Card } from "../shared/Card.js";
import { Tag } from "../shared/Tag.js";
import { Terminal } from "../shared/Terminal.js";
import { SplitDiff } from "../shared/SplitDiff.js";
import { JsonView } from "../shared/JsonView.js";
import { PipelineFlow, approxSteps, extensionSteps } from "../shared/PipelineFlow.js";

export interface TrainingGroundProps {
  demos: DemosState;
  pipeline: PipelineState;
  schemaRegistry: SchemaRegistryState;
  preview?: PreviewCapability;
}

export function TrainingGround({
  demos,
  pipeline,
  schemaRegistry,
  preview,
}: TrainingGroundProps) {
  const handleTrain = (demo: Demonstration) => {
    pipeline.runEvolution(demo);
  };

  const handlePromote = () => {
    if (
      pipeline.result?.kind === "converged" &&
      pipeline.result.extOutcome.kind === "converged"
    ) {
      const ext = pipeline.result.extOutcome;
      const current = schemaRegistry.current;
      const newVersion = bumpMinor(current.version);
      schemaRegistry.promote(ext.candidateSchema, newVersion);
    }
  };

  const result = pipeline.result;
  const isConverged = result?.kind === "converged";
  const isDiverged = result?.kind === "diverged";

  // Build diff view data if we have approx outcome with a gap
  let diffData: DiffViewData | undefined;
  if (result && (result.kind === "converged" || result.kind === "diverged")) {
    const approx = result.approxOutcome;
    if (approx.kind === "insufficient") {
      diffData = {
        expert: approx.observedBehavior.fingerprint,
        system: approx.behavior.fingerprint,
        gap: approx.gap,
      };
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Training Ground</h2>
      <p className="text-sm text-slate-500">
        Run full evolution on a demonstration: approximation, extension, and optionally promote.
      </p>

      {/* Demo selector */}
      <Card title="Select Demonstration">
        {demos.demos.length === 0 ? (
          <p className="text-sm text-slate-500">
            No demos available. Add demos in the Demo Library first.
          </p>
        ) : (
          <div className="space-y-1">
            {demos.demos.map((demo) => (
              <div key={demo.id} className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">
                  {demo.source.type}: {demo.source.uri ?? demo.id}
                </span>
                <button
                  onClick={() => handleTrain(demo)}
                  disabled={pipeline.running}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Train
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pipeline flow */}
      {pipeline.phase !== "idle" && (
        <div className="space-y-2">
          {pipeline.phase === "approximation" && (
            <PipelineFlow steps={approxSteps(pipeline.activeStage, !!pipeline.error)} />
          )}
          {pipeline.phase === "extension" && (
            <PipelineFlow steps={extensionSteps(pipeline.activeStage, !!pipeline.error)} />
          )}
        </div>
      )}

      {/* Real-time logs */}
      {pipeline.logs.length > 0 && (
        <Terminal lines={pipeline.logs} maxHeight="250px" />
      )}

      {/* Error */}
      {pipeline.error && (
        <Card accent="red">
          <div className="text-sm text-red-700">{pipeline.error}</div>
        </Card>
      )}

      {/* Result summary */}
      {result && (
        <Card accent={isConverged ? "green" : isDiverged ? "orange" : "neutral"}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">Result:</span>
            <Tag
              label={result.kind}
              variant={isConverged ? "success" : isDiverged ? "warning" : result.kind === "failed" ? "error" : "neutral"}
            />
          </div>

          {result.kind === "assimilated" && (
            <p className="text-sm text-slate-600">
              Current schema is sufficient. No evolution needed.
            </p>
          )}

          {result.kind === "failed" && (
            <p className="text-sm text-red-600">{result.message}</p>
          )}
        </Card>
      )}

      {/* 3-column diff */}
      {diffData && <SplitDiff diff={diffData} preview={preview} />}

      {/* Schema diff for converged result */}
      {isConverged && result.extOutcome.kind === "converged" && (
        <Card accent="green" title="Proposed Schema Extensions">
          <div className="space-y-2">
            {result.extOutcome.candidateSchema.extensions.map((ext, i) => (
              <div key={i} className="border border-slate-200 rounded p-3">
                <div className="text-xs font-medium text-slate-700 mb-1">{ext.description}</div>
                {ext.newFields.length > 0 && (
                  <div className="mb-1">
                    <span className="text-xs text-slate-500">New fields: </span>
                    {ext.newFields.map((f) => (
                      <Tag key={f.name} label={f.name} variant="info" className="mr-1" />
                    ))}
                  </div>
                )}
                {ext.newRules.length > 0 && (
                  <div>
                    <span className="text-xs text-slate-500">New rules: </span>
                    <JsonView data={ext.newRules} defaultExpanded={false} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Promote button */}
      {isConverged && (
        <div className="flex justify-end">
          <button
            onClick={handlePromote}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
          >
            Promote to Schema v{bumpMinor(schemaRegistry.current.version)}
          </button>
        </div>
      )}
    </div>
  );
}

function bumpMinor(version: string): string {
  const parts = version.split(".");
  if (parts.length !== 3) return `${version}.1`;
  const [major, minor] = parts;
  return `${major}.${parseInt(minor, 10) + 1}.0`;
}
