import { Stage } from "../../types/pipeline.js";

export type StepStatus = "pending" | "active" | "complete" | "error";

export interface PipelineStep {
  stage: Stage;
  label: string;
  status: StepStatus;
}

export interface PipelineFlowProps {
  steps: PipelineStep[];
  className?: string;
}

const statusStyles: Record<StepStatus, { bg: string; text: string; ring: string }> = {
  pending: { bg: "bg-slate-100", text: "text-slate-400", ring: "ring-slate-200" },
  active: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-300" },
  complete: { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-300" },
  error: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-300" },
};

const connectorColors: Record<StepStatus, string> = {
  pending: "bg-slate-200",
  active: "bg-blue-300",
  complete: "bg-green-300",
  error: "bg-red-300",
};

export function PipelineFlow({ steps, className = "" }: PipelineFlowProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {steps.map((step, i) => {
        const style = statusStyles[step.status];
        return (
          <div key={step.stage} className="flex items-center gap-1">
            <div
              className={`px-3 py-1.5 rounded-md text-xs font-medium ring-1 ${style.bg} ${style.text} ${style.ring}`}
            >
              {step.label}
              {step.status === "active" && (
                <span className="ml-1 inline-block animate-pulse">...</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-4 h-0.5 ${connectorColors[step.status]}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Default approximation pipeline steps. */
export function approxSteps(activeStage?: Stage, error?: boolean): PipelineStep[] {
  const stages = [Stage.Approximate, Stage.Validate, Stage.Compile, Stage.Execute, Stage.Compare];
  const labels: Record<string, string> = {
    [Stage.Approximate]: "Approximate",
    [Stage.Validate]: "Validate",
    [Stage.Compile]: "Compile",
    [Stage.Execute]: "Execute",
    [Stage.Compare]: "Compare",
  };

  return stages.map((stage) => ({
    stage,
    label: labels[stage] ?? stage,
    status: getStatus(stage, stages, activeStage, error),
  }));
}

/** Default extension pipeline steps. */
export function extensionSteps(activeStage?: Stage, error?: boolean): PipelineStep[] {
  const stages = [Stage.Extend, Stage.Validate, Stage.Compile, Stage.Execute, Stage.Compare];
  const labels: Record<string, string> = {
    [Stage.Extend]: "Extend",
    [Stage.Validate]: "ValidateC",
    [Stage.Compile]: "CompileC",
    [Stage.Execute]: "Execute",
    [Stage.Compare]: "Compare",
  };

  return stages.map((stage) => ({
    stage,
    label: labels[stage] ?? stage,
    status: getStatus(stage, stages, activeStage, error),
  }));
}

function getStatus(
  stage: Stage,
  ordered: Stage[],
  activeStage?: Stage,
  error?: boolean,
): StepStatus {
  if (!activeStage) return "pending";
  const idx = ordered.indexOf(stage);
  const activeIdx = ordered.indexOf(activeStage);
  if (idx < activeIdx) return "complete";
  if (idx === activeIdx) return error ? "error" : "active";
  return "pending";
}
