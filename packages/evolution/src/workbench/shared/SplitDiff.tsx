import type { DiffViewData, PreviewCapability } from "../types.js";
import { JsonView } from "./JsonView.js";
import { PreviewSlot } from "./PreviewSlot.js";
import { Tag } from "./Tag.js";

export interface SplitDiffProps {
  diff: DiffViewData;
  preview?: PreviewCapability;
  className?: string;
}

export function SplitDiff({ diff, preview, className = "" }: SplitDiffProps) {
  const expertPreview = preview?.renderBehavior(diff.expert);
  const systemPreview = preview?.renderBehavior(diff.system);

  return (
    <div className={`grid grid-cols-3 gap-3 ${className}`}>
      {/* Expert (expected) */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-2">
          Expert
          <Tag label="Expected" variant="info" />
        </div>
        <PreviewSlot config={expertPreview} data={diff.expert} />
      </div>

      {/* Gap (middle) */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-2">
          Gap
          <Tag
            label={diff.gap.severity}
            variant={severityVariant(diff.gap.severity)}
          />
        </div>
        <div className="border border-slate-200 rounded-lg p-3">
          <div className="text-xs text-slate-600 mb-2">{diff.gap.summary}</div>
          <div className="space-y-1">
            {diff.gap.discrepancies.map((d, i) => (
              <div key={i} className="text-xs font-mono">
                <span className="text-slate-500">{d.path}</span>
                <span className="text-slate-400 mx-1">({d.type})</span>
                {d.expected !== undefined && (
                  <span className="text-green-600">expected: {JSON.stringify(d.expected)}</span>
                )}
                {d.actual !== undefined && (
                  <span className="text-red-600 ml-1">actual: {JSON.stringify(d.actual)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System (actual) */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-2">
          System
          <Tag label="Actual" variant="neutral" />
        </div>
        <PreviewSlot config={systemPreview} data={diff.system} />
      </div>
    </div>
  );
}

function severityVariant(severity: string) {
  switch (severity) {
    case "minor": return "neutral" as const;
    case "moderate": return "warning" as const;
    case "major": return "error" as const;
    case "critical": return "error" as const;
    default: return "neutral" as const;
  }
}
