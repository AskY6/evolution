/**
 * BI Compiler — DashboardPayload → DashboardExecutable.
 *
 * Pure transformation: takes a validated Dashboard payload and produces
 * the ECharts-based executable representation.
 */

import type { DashboardPayload, ChartConfig } from "./instance";
import type {
  DashboardExecutable,
  DashboardPanel,
  EChartsOption,
  EChartsSeries,
} from "./renderer";

// ---------------------------------------------------------------------------
// Compilation: DashboardPayload → DashboardExecutable
// ---------------------------------------------------------------------------

export function compileDashboard(payload: DashboardPayload): DashboardExecutable {
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

export function compileChart(chart: ChartConfig): EChartsOption {
  if (!chart.series || chart.series.length === 0) {
    throw new Error(`Chart "${chart.id}" must have at least one series`);
  }

  if (chart.chartType === "pie") {
    return compilePieChart(chart);
  }

  return compileCartesianChart(chart);
}

export function compileCartesianChart(chart: ChartConfig): EChartsOption {
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

export function compilePieChart(chart: ChartConfig): EChartsOption {
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
// Runtime feature inference
// ---------------------------------------------------------------------------

export function inferRequiredFeatures(payload: DashboardPayload): string[] {
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
