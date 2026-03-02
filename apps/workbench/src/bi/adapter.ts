/**
 * BiAdapter — BI domain implementation of DomainAdapter.
 *
 * Translates between the evolution framework's generic types and
 * BI Dashboard visualization:
 *
 * - compile:     Instance payload (DashboardPayload) → DashboardExecutable
 * - compileC:    CandidateInstance → DashboardExecutable (with runtime checks)
 * - execute:     DashboardExecutable → DashboardFingerprint (simulated behavior)
 * - fingerprint: Raw dashboard-like config → structured Behavior
 * - runtime:     BI rendering engine capability declaration
 */

import type {
  DomainAdapter,
  Either,
  Schema,
  CandidateSchema,
  Extension,
  Instance,
  CandidateInstance,
  Executable,
  CompileResult,
  Behavior,
  RuntimeCapability,
  CompileError,
  ExecuteError,
  ValidationError,
} from "@evolution/core";
import { left, right, Supportability } from "@evolution/core";
import type {
  BiSchema,
  BiExtension,
  DashboardPayload,
  ChartConfig,
  EChartsOption,
  EChartsSeries,
  DashboardExecutable,
  DashboardPanel,
  DashboardFingerprint,
  ChartFingerprint,
} from "./types";
import { validateBiInstance, validateBiCandidateInstance } from "./validator";

// ---------------------------------------------------------------------------
// Runtime capability declaration
// ---------------------------------------------------------------------------

const BI_RUNTIME: RuntimeCapability = {
  features: [
    { name: "chart:bar",    supportability: Supportability.Supported, description: "Bar chart rendering" },
    { name: "chart:line",   supportability: Supportability.Supported, description: "Line chart rendering" },
    { name: "chart:pie",    supportability: Supportability.Supported, description: "Pie chart rendering" },
    { name: "chart:scatter",supportability: Supportability.Feasible,  description: "Scatter plot (not yet implemented)" },
    { name: "chart:radar",  supportability: Supportability.Unfeasible,description: "Radar chart (no engine support)" },
    { name: "axis:category",supportability: Supportability.Supported },
    { name: "axis:value",   supportability: Supportability.Supported },
    { name: "axis:time",    supportability: Supportability.Feasible, description: "Time axis (needs date formatting)" },
    { name: "filter:basic", supportability: Supportability.Supported, description: "Basic comparison filters" },
    { name: "filter:in",    supportability: Supportability.Supported, description: "IN-list filters" },
    { name: "sort:single",  supportability: Supportability.Supported, description: "Single-field sorting" },
    { name: "legend",       supportability: Supportability.Supported },
    { name: "title",        supportability: Supportability.Supported },
    { name: "dashboard:multi-chart",    supportability: Supportability.Supported, description: "Multiple charts in one dashboard" },
    { name: "dashboard:shared-filters", supportability: Supportability.Feasible,  description: "Shared filters across charts (needs global state)" },
    { name: "dashboard:data-binding",   supportability: Supportability.Feasible,  description: "Cross-chart interactions (needs event bus)" },
  ],
};

// ---------------------------------------------------------------------------
// BiAdapter
// ---------------------------------------------------------------------------

export class BiAdapter implements DomainAdapter {
  compile(instance: Instance): Either<CompileError, Executable> {
    try {
      const payload = instance.payload as unknown as DashboardPayload;
      const artifact = compileDashboard(payload);
      return right({ format: "echarts-dashboard", artifact });
    } catch (err) {
      return left({
        kind: "compile",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  compileC(candidate: CandidateInstance): CompileResult {
    const merged = {
      ...candidate.basePayload,
      ...candidate.extensionPayload,
    } as unknown as DashboardPayload;

    const requiredFeatures = inferRequiredFeatures(merged);
    const blocked = requiredFeatures.filter(
      (f) => lookupFeature(f) === Supportability.Unfeasible,
    );
    const degraded = requiredFeatures.filter(
      (f) => lookupFeature(f) === Supportability.Feasible,
    );

    if (blocked.length > 0) {
      return {
        kind: "blocked",
        constraints: blocked.map((f) => ({
          feature: f,
          reason: `Feature "${f}" is not supported by the BI runtime`,
        })),
      };
    }

    try {
      const artifact = compileDashboard(merged);
      const executable: Executable = { format: "echarts-dashboard", artifact };

      if (degraded.length > 0) {
        return {
          kind: "degraded",
          executable,
          missing: degraded.map((f) => ({
            feature: f,
            reason: `Feature "${f}" requires engineering effort`,
          })),
        };
      }

      return { kind: "compiled", executable };
    } catch (err) {
      return {
        kind: "blocked",
        constraints: [{
          feature: "compile",
          reason: err instanceof Error ? err.message : String(err),
        }],
      };
    }
  }

  execute(executable: Executable): Either<ExecuteError, Behavior> {
    if (executable.format !== "echarts-dashboard") {
      return left({
        kind: "execute",
        message: `Unsupported executable format: "${executable.format}"`,
      });
    }

    try {
      const dashboard = executable.artifact as DashboardExecutable;
      const fingerprint = extractFingerprint(dashboard);
      return right({ fingerprint: fingerprint as unknown as Record<string, unknown> });
    } catch (err) {
      return left({
        kind: "execute",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  fingerprint(raw: unknown): Behavior {
    // Accepts a raw DashboardExecutable-like object from expert Pro Code
    const dashboard = raw as DashboardExecutable;
    const fp = extractFingerprint(dashboard);
    return { fingerprint: fp as unknown as Record<string, unknown> };
  }

  runtime(): RuntimeCapability {
    return BI_RUNTIME;
  }

  validate(schema: Schema, instance: Instance): ReadonlyArray<ValidationError> {
    return validateBiInstance(schema as BiSchema, instance);
  }

  validateCandidate(
    candidateSchema: CandidateSchema,
    candidate: CandidateInstance,
  ): ReadonlyArray<ValidationError> {
    const base = candidateSchema.baseSchema as BiSchema;
    const exts = candidateSchema.extensions as ReadonlyArray<BiExtension>;
    return validateBiCandidateInstance(base, exts, candidate);
  }

  materialize(
    base: Schema,
    extensions: ReadonlyArray<Extension>,
    newVersion: string,
  ): Schema {
    const b = base as BiSchema;
    const exts = extensions as ReadonlyArray<BiExtension>;
    return {
      id: b.id,
      version: newVersion,
      fields: [...b.fields, ...exts.flatMap((e) => e.newFields)],
      rules: [...b.rules, ...exts.flatMap((e) => e.newRules)],
    } satisfies BiSchema;
  }
}

// ---------------------------------------------------------------------------
// Compilation: DashboardPayload → DashboardExecutable
// ---------------------------------------------------------------------------

function compileDashboard(payload: DashboardPayload): DashboardExecutable {
  if (!payload.charts || payload.charts.length === 0) {
    throw new Error("Dashboard must contain at least one chart");
  }

  const panels: DashboardPanel[] = payload.charts.map((chart) => ({
    id: chart.id,
    position: chart.position,
    option: compileChart(chart),
  }));

  return { title: payload.title, layout: payload.layout, panels };
}

function compileChart(chart: ChartConfig): EChartsOption {
  if (!chart.series || chart.series.length === 0) {
    throw new Error(`Chart "${chart.id}" must have at least one series`);
  }

  if (chart.chartType === "pie") {
    return compilePieChart(chart);
  }

  return compileCartesianChart(chart);
}

function compileCartesianChart(chart: ChartConfig): EChartsOption {
  if (!chart.xAxis) throw new Error(`Chart "${chart.id}" requires xAxis for type "${chart.chartType}"`);

  const series: EChartsSeries[] = chart.series.map((s) => ({
    type: chart.chartType as "bar" | "line",
    name: s.name,
    encode: {
      x: chart.xAxis!.field,
      y: s.field,
    },
    ...(s.color ? { itemStyle: { color: s.color } } : {}),
  }));

  return {
    ...(chart.title ? { title: { text: chart.title } } : {}),
    xAxis: {
      type: "category",
      name: chart.xAxis?.label,
      data: chart.dataSource.dimensions as string[],
    },
    yAxis: {
      type: "value",
      name: chart.yAxis?.label,
    },
    series,
    ...(series.length > 1 ? { legend: { data: series.map((s) => s.name) } } : {}),
  };
}

function compilePieChart(chart: ChartConfig): EChartsOption {
  // For pie, series[0].field is the value field; dimensions serve as slice names
  const series: EChartsSeries[] = chart.series.map((s) => ({
    type: "pie" as const,
    name: s.name,
    data: chart.dataSource.dimensions.map((dim, i) => ({
      name: String(dim),
      value: i + 1, // placeholder — real data comes from runtime
    })),
    ...(s.color ? { itemStyle: { color: s.color } } : {}),
  }));

  return {
    ...(chart.title ? { title: { text: chart.title } } : {}),
    series,
    legend: { data: chart.dataSource.dimensions as string[] },
  };
}

// ---------------------------------------------------------------------------
// Execution: DashboardExecutable → DashboardFingerprint
// ---------------------------------------------------------------------------

function extractFingerprint(dashboard: DashboardExecutable): DashboardFingerprint {
  const charts: ChartFingerprint[] = dashboard.panels.map((panel) => {
    const metrics = panel.option.series
      .filter((s) => s.encode?.y)
      .map((s) => s.encode!.y);
    const dimensions = panel.option.xAxis?.data
      ? [...panel.option.xAxis.data]
      : [];

    return {
      id: panel.id,
      chartType: panel.option.series[0]?.type ?? "unknown",
      seriesCount: panel.option.series.length,
      metrics,
      dimensions,
    };
  });

  const allMetrics = [...new Set(charts.flatMap((c) => c.metrics))];
  const allDimensions = [...new Set(charts.flatMap((c) => c.dimensions))];
  const chartTypes = [...new Set(charts.map((c) => c.chartType))];

  return {
    chartCount: dashboard.panels.length,
    chartTypes,
    layoutShape: { columns: dashboard.layout.columns, rows: dashboard.layout.rows },
    allMetrics,
    allDimensions,
    sharedFilterCount: 0, // populated from raw payload when available
    dataBindingCount: 0,
    charts,
  };
}

// ---------------------------------------------------------------------------
// Runtime feature inference
// ---------------------------------------------------------------------------

function inferRequiredFeatures(payload: DashboardPayload): string[] {
  const features: string[] = ["dashboard:multi-chart"];

  if (!payload.charts) return features;

  for (const chart of payload.charts) {
    features.push(`chart:${chart.chartType}`);

    if (chart.chartType !== "pie") {
      features.push("axis:category", "axis:value");
    }

    if (chart.dataSource?.filters && chart.dataSource.filters.length > 0) {
      features.push("filter:basic");
      if (chart.dataSource.filters.some((f) => f.operator === "in")) {
        features.push("filter:in");
      }
    }

    if (chart.dataSource?.sort) features.push("sort:single");
    if (chart.title) features.push("title");
    if (chart.series && chart.series.length > 1) features.push("legend");
  }

  if (payload.sharedFilters && payload.sharedFilters.length > 0) {
    features.push("dashboard:shared-filters");
  }

  if (payload.dataBindings && payload.dataBindings.length > 0) {
    features.push("dashboard:data-binding");
  }

  return [...new Set(features)];
}

function lookupFeature(name: string): Supportability {
  const feature = BI_RUNTIME.features.find((f) => f.name === name);
  return feature?.supportability ?? Supportability.Unfeasible;
}
