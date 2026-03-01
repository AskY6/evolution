import { useState } from "react";
import type { Demonstration, Schema } from "../../types/index.js";
import type { PipelineState } from "../hooks/usePipeline.js";
import type { PreviewCapability } from "../types.js";
import { Card } from "../shared/Card.js";
import { Tag } from "../shared/Tag.js";
import { JsonView } from "../shared/JsonView.js";
import { Terminal } from "../shared/Terminal.js";
import { PipelineFlow, approxSteps } from "../shared/PipelineFlow.js";
import { PreviewSlot } from "../shared/PreviewSlot.js";

export interface PlaygroundProps {
  schema: Schema;
  pipeline: PipelineState;
  preview?: PreviewCapability;
}

export function Playground({ schema, pipeline, preview }: PlaygroundProps) {
  const [intent, setIntent] = useState("");

  const handleRun = () => {
    if (!intent.trim()) return;
    const demo: Demonstration = {
      id: `playground-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: { type: "playground", raw: { intent: intent.trim() } },
      observedBehavior: { fingerprint: {} },
    };
    pipeline.runApproximation(demo);
  };

  const steps = approxSteps(
    pipeline.activeStage,
    pipeline.error !== null,
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Playground</h2>
      <p className="text-sm text-slate-500">
        Test how the current schema handles an intent through the approximation pipeline.
      </p>

      {/* Intent input */}
      <Card>
        <div className="flex gap-2">
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
            placeholder="Describe what you want to build..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
            disabled={pipeline.running}
          />
          <button
            onClick={handleRun}
            disabled={pipeline.running || !intent.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pipeline.running ? "Running..." : "Run"}
          </button>
        </div>
      </Card>

      {/* Pipeline visualization */}
      <PipelineFlow steps={steps} />

      {/* Logs */}
      {pipeline.logs.length > 0 && (
        <Terminal lines={pipeline.logs} maxHeight="200px" />
      )}

      {/* Error */}
      {pipeline.error && (
        <Card accent="red">
          <div className="text-sm text-red-700">{pipeline.error}</div>
        </Card>
      )}

      {/* Result */}
      {pipeline.approxResult && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Result:</span>
            <Tag
              label={pipeline.approxResult.kind === "sufficient" ? "Sufficient" : "Insufficient"}
              variant={pipeline.approxResult.kind === "sufficient" ? "success" : "warning"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card title="Instance">
              <JsonView data={pipeline.approxResult.instance.payload} defaultExpanded={true} />
            </Card>

            <Card title="Behavior">
              {preview ? (
                <PreviewSlot
                  config={preview.renderBehavior(pipeline.approxResult.behavior.fingerprint)}
                />
              ) : (
                <JsonView data={pipeline.approxResult.behavior.fingerprint} defaultExpanded={true} />
              )}
            </Card>
          </div>

          {pipeline.approxResult.kind === "insufficient" && (
            <Card accent="orange" title="Gap Detected">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Tag label={pipeline.approxResult.gap.severity} variant="warning" />
                  <span className="text-sm text-slate-600">
                    {pipeline.approxResult.gap.summary}
                  </span>
                </div>
                <JsonView data={pipeline.approxResult.gap.discrepancies} defaultExpanded={false} />
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
