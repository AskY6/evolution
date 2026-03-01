/**
 * BiAdapter — BI domain implementation of DomainAdapter.
 *
 * Translates between the evolution framework's generic types and
 * BI-specific ECharts visualization:
 *
 * - compile:     Instance payload → ECharts option
 * - compileC:    CandidateInstance → ECharts option (with runtime checks)
 * - execute:     ECharts option → simulated Behavior
 * - fingerprint: Raw ECharts-like config → structured Behavior
 * - runtime:     BI rendering engine capability declaration
 */

import type {
  DomainAdapter,
  Either,
  Instance,
  CandidateInstance,
  Executable,
  CompileResult,
  Behavior,
  RuntimeCapability,
  CompileError,
  ExecuteError,
} from "@evolution/core";
import { left, right, Supportability } from "@evolution/core";
import type {
  BiPayload,
  EChartsOption,
  EChartsSeries,
  BiFingerprint,
  ApiFingerprint,
  RenderFingerprint,
} from "./types";

// ---------------------------------------------------------------------------
// Runtime capability declaration
// ---------------------------------------------------------------------------

const BI_RUNTIME: RuntimeCapability = {
  features: [
    { name: "chart:bar", supportability: Supportability.Supported, description: "Bar chart rendering" },
    { name: "chart:line", supportability: Supportability.Supported, description: "Line chart rendering" },
    { name: "chart:pie", supportability: Supportability.Feasible, description: "Pie chart rendering (not yet implemented)" },
    { name: "chart:scatter", supportability: Supportability.Feasible, description: "Scatter plot rendering (not yet implemented)" },
    { name: "chart:radar", supportability: Supportability.Unfeasible, description: "Radar chart (no rendering engine support)" },
    { name: "axis:category", supportability: Supportability.Supported },
    { name: "axis:value", supportability: Supportability.Supported },
    { name: "axis:time", supportability: Supportability.Feasible, description: "Time axis (needs date formatting support)" },
    { name: "filter:basic", supportability: Supportability.Supported, description: "Basic comparison filters" },
    { name: "filter:in", supportability: Supportability.Supported, description: "IN-list filters" },
    { name: "sort:single", supportability: Supportability.Supported, description: "Single-field sorting" },
    { name: "legend", supportability: Supportability.Supported, description: "Chart legend" },
    { name: "title", supportability: Supportability.Supported, description: "Chart title" },
  ],
};

// ---------------------------------------------------------------------------
// BiAdapter
// ---------------------------------------------------------------------------

export class BiAdapter implements DomainAdapter {
  compile(instance: Instance): Either<CompileError, Executable> {
    try {
      const payload = instance.payload as unknown as BiPayload;
      const option = compileToECharts(payload);
      return right({ format: "echarts", artifact: option });
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
    } as unknown as BiPayload;

    // Check runtime capabilities
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
      const option = compileToECharts(merged);
      const executable: Executable = { format: "echarts", artifact: option };

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
    if (executable.format !== "echarts") {
      return left({
        kind: "execute",
        message: `Unsupported executable format: "${executable.format}"`,
      });
    }

    try {
      const option = executable.artifact as EChartsOption;
      const fingerprint = extractFingerprint(option);
      return right({ fingerprint: fingerprint as unknown as Record<string, unknown> });
    } catch (err) {
      return left({
        kind: "execute",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  fingerprint(raw: unknown): Behavior {
    // Handles raw ECharts option objects from expert Pro Code
    const option = raw as EChartsOption;
    const fp = extractFingerprint(option);
    return { fingerprint: fp as unknown as Record<string, unknown> };
  }

  runtime(): RuntimeCapability {
    return BI_RUNTIME;
  }
}

// ---------------------------------------------------------------------------
// Compilation: BiPayload → EChartsOption
// ---------------------------------------------------------------------------

function compileToECharts(payload: BiPayload): EChartsOption {
  if (!payload.chartType) {
    throw new Error("Missing chartType in payload");
  }
  if (!payload.series || payload.series.length === 0) {
    throw new Error("At least one series is required");
  }

  const series: EChartsSeries[] = payload.series.map((s) => ({
    type: payload.chartType,
    name: s.name,
    encode: {
      x: payload.xAxis.field,
      y: s.field,
    },
    ...(s.color ? { itemStyle: { color: s.color } } : {}),
  }));

  const option: EChartsOption = {
    ...(payload.title ? { title: { text: payload.title } } : {}),
    xAxis: {
      type: "category",
      name: payload.xAxis.label,
      data: payload.dataSource.dimensions,
    },
    yAxis: {
      type: "value",
      name: payload.yAxis.label,
    },
    series,
    ...(series.length > 1 ? { legend: { data: series.map((s) => s.name) } } : {}),
  };

  return option;
}

// ---------------------------------------------------------------------------
// Execution: EChartsOption → BiFingerprint
// ---------------------------------------------------------------------------

function extractFingerprint(option: EChartsOption): BiFingerprint {
  const api: ApiFingerprint = {
    metrics: option.series.map((s) => s.encode.y),
    dimensions: option.xAxis.data ? [...option.xAxis.data] : [],
    filters: [], // Filters are applied before compilation, not visible in the option
    sort: undefined,
  };

  const render: RenderFingerprint = {
    chartType: option.series.length > 0 ? option.series[0].type : "unknown",
    seriesCount: option.series.length,
    seriesTypes: [...new Set(option.series.map((s) => s.type))],
    xAxisType: option.xAxis.type,
    yAxisType: option.yAxis.type,
    hasTitle: option.title !== undefined,
    hasLegend: option.legend !== undefined,
  };

  return { api, render };
}

// ---------------------------------------------------------------------------
// Runtime feature inference
// ---------------------------------------------------------------------------

function inferRequiredFeatures(payload: BiPayload): string[] {
  const features: string[] = [];

  features.push(`chart:${payload.chartType}`);
  features.push("axis:category"); // xAxis is always category for bar/line
  features.push("axis:value");    // yAxis is always value for bar/line

  if (payload.dataSource.filters && payload.dataSource.filters.length > 0) {
    const hasIn = payload.dataSource.filters.some((f) => f.operator === "in");
    features.push("filter:basic");
    if (hasIn) features.push("filter:in");
  }

  if (payload.dataSource.sort) {
    features.push("sort:single");
  }

  if (payload.title) features.push("title");
  if (payload.series.length > 1) features.push("legend");

  return features;
}

function lookupFeature(name: string): Supportability {
  const feature = BI_RUNTIME.features.find((f) => f.name === name);
  return feature?.supportability ?? Supportability.Unfeasible;
}
