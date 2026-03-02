/**
 * BI Renderer — ECharts types, fingerprint types, runtime capability, and execution helpers.
 *
 * Owns the rendering target types (EChartsOption, DashboardExecutable),
 * the behavioral fingerprint types, the BI_RUNTIME capability declaration,
 * and the extractFingerprint / lookupFeature functions used during execute().
 */

import { Supportability } from "@evolution/core";
import type { RuntimeCapability } from "@evolution/core";
import type { GridLayout } from "./instance";

// ---------------------------------------------------------------------------
// Dashboard compilation target — ECharts panels
// ---------------------------------------------------------------------------

/** A single ECharts option (supports bar, line, and pie). */
export interface EChartsOption {
  readonly title?: { readonly text: string };
  readonly xAxis?: EChartsAxis;
  readonly yAxis?: EChartsAxis;
  readonly series: ReadonlyArray<EChartsSeries>;
  readonly legend?: { readonly data: ReadonlyArray<string> };
}

export interface EChartsAxis {
  readonly type: "category" | "value";
  readonly name?: string;
  readonly data?: ReadonlyArray<string>;
}

export interface EChartsSeries {
  readonly type: "bar" | "line" | "pie";
  readonly name: string;
  readonly encode?: { readonly x: string; readonly y: string };
  readonly itemStyle?: { readonly color?: string };
  /** Used by pie charts: pre-computed data points. */
  readonly data?: ReadonlyArray<{ readonly name: string; readonly value: number }>;
}

/** A compiled chart panel inside the dashboard. */
export interface DashboardPanel {
  readonly id: string;
  readonly position: import("./instance").GridPosition;
  readonly option: EChartsOption;
}

/** The full dashboard compilation target, passed to execute(). */
export interface DashboardExecutable {
  readonly title: string;
  readonly layout: GridLayout;
  readonly panels: ReadonlyArray<DashboardPanel>;
}

// ---------------------------------------------------------------------------
// Dashboard behavioral fingerprint — what we compare
// ---------------------------------------------------------------------------

/** Per-chart summary inside the dashboard fingerprint. */
export interface ChartFingerprint {
  readonly id: string;
  readonly chartType: string;
  readonly seriesCount: number;
  readonly metrics: ReadonlyArray<string>;
  readonly dimensions: ReadonlyArray<string>;
}

/** The full dashboard behavioral fingerprint. */
export interface DashboardFingerprint {
  readonly chartCount: number;
  readonly chartTypes: ReadonlyArray<string>;
  readonly layoutShape: { readonly columns: number; readonly rows: number };
  readonly allMetrics: ReadonlyArray<string>;
  readonly allDimensions: ReadonlyArray<string>;
  readonly sharedFilterCount: number;
  readonly dataBindingCount: number;
  readonly charts: ReadonlyArray<ChartFingerprint>;
}

// ---------------------------------------------------------------------------
// Runtime capability declaration
// ---------------------------------------------------------------------------

export const BI_RUNTIME: RuntimeCapability = {
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
// Execution: DashboardExecutable → DashboardFingerprint
// ---------------------------------------------------------------------------

export function extractFingerprint(dashboard: DashboardExecutable): DashboardFingerprint {
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

export function lookupFeature(name: string): Supportability {
  const feature = BI_RUNTIME.features.find((f) => f.name === name);
  return feature?.supportability ?? Supportability.Unfeasible;
}
