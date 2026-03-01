import type { EvolutionRecord } from "../../types/memory.js";
import { EvolutionOutcome } from "../../types/memory.js";
import { Card } from "../shared/Card.js";
import { Tag } from "../shared/Tag.js";

export interface BoundaryViewProps {
  records: ReadonlyArray<EvolutionRecord>;
}

export function BoundaryView({ records }: BoundaryViewProps) {
  const total = records.length;
  const success = records.filter((r) => r.outcome === EvolutionOutcome.Success).length;
  const failed = records.filter((r) => r.outcome === EvolutionOutcome.Failure).length;
  const needsReview = records.filter((r) => r.outcome === EvolutionOutcome.NeedsHumanReview).length;

  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Boundary View</h2>
      <p className="text-sm text-slate-500">
        Overview of the system's learning progress and evolution statistics.
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total Evolutions"
          value={total}
          accent="blue"
        />
        <StatCard
          label="Auto-Internalized"
          value={success}
          suffix={total > 0 ? `(${successRate}%)` : ""}
          accent="green"
        />
        <StatCard
          label="Needs Human Review"
          value={needsReview}
          accent="orange"
        />
      </div>

      {/* Progress bars by outcome */}
      {total > 0 && (
        <Card title="Outcome Distribution">
          <div className="space-y-3">
            <ProgressBar
              label="Success"
              count={success}
              total={total}
              color="bg-green-500"
            />
            <ProgressBar
              label="Failed"
              count={failed}
              total={total}
              color="bg-red-400"
            />
            <ProgressBar
              label="Needs Review"
              count={needsReview}
              total={total}
              color="bg-orange-400"
            />
          </div>
        </Card>
      )}

      {/* Insights */}
      <Card title="Insights">
        {total === 0 ? (
          <p className="text-sm text-slate-500">
            No evolution records yet. Train the system with demonstrations to see insights.
          </p>
        ) : (
          <div className="space-y-2 text-sm text-slate-600">
            {successRate >= 80 && (
              <InsightLine
                variant="success"
                text={`Strong auto-internalization rate (${successRate}%). The system is learning effectively.`}
              />
            )}
            {successRate > 0 && successRate < 50 && (
              <InsightLine
                variant="warning"
                text={`Low success rate (${successRate}%). The system may need more diverse demonstrations or the schema might need manual review.`}
              />
            )}
            {needsReview > 0 && (
              <InsightLine
                variant="warning"
                text={`${needsReview} evolution(s) need human review. Check the Version panel for pending items.`}
              />
            )}
            {failed > 0 && (
              <InsightLine
                variant="error"
                text={`${failed} evolution(s) failed. These represent cases where the extension pipeline diverged.`}
              />
            )}
          </div>
        )}
      </Card>

      {/* Recent records */}
      {records.length > 0 && (
        <Card title="Recent Records">
          <div className="space-y-1">
            {[...records].reverse().slice(0, 10).map((record) => (
              <div key={record.id} className="flex items-center justify-between py-1 text-xs">
                <span className="text-slate-500">{record.timestamp}</span>
                <Tag
                  label={record.outcome}
                  variant={
                    record.outcome === EvolutionOutcome.Success
                      ? "success"
                      : record.outcome === EvolutionOutcome.Failure
                        ? "error"
                        : "warning"
                  }
                />
                <span className="text-slate-600 font-mono">
                  {record.fromSchemaVersion}
                  {record.toSchemaVersion && ` → ${record.toSchemaVersion}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent: "blue" | "green" | "orange";
}) {
  return (
    <Card accent={accent}>
      <div className="text-center">
        <div className="text-2xl font-bold text-slate-800">
          {value}
          {suffix && <span className="text-sm font-normal text-slate-500 ml-1">{suffix}</span>}
        </div>
        <div className="text-xs text-slate-500 mt-1">{label}</div>
      </div>
    </Card>
  );
}

function ProgressBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600 mb-1">
        <span>{label}</span>
        <span>{count} ({pct}%)</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InsightLine({ variant, text }: { variant: "success" | "warning" | "error"; text: string }) {
  const dot = variant === "success" ? "bg-green-500" : variant === "warning" ? "bg-orange-400" : "bg-red-400";
  return (
    <div className="flex items-start gap-2">
      <div className={`w-2 h-2 rounded-full ${dot} mt-1.5 shrink-0`} />
      <span>{text}</span>
    </div>
  );
}
