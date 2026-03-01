/**
 * BI-specific types — ECharts compilation targets and fingerprint structures.
 *
 * These types are internal to @evolution/bi. The framework only sees
 * Executable (format: "echarts") and Behavior (structured fingerprint).
 */

// ---------------------------------------------------------------------------
// Instance payload structure — what a BI Instance contains
// ---------------------------------------------------------------------------

export interface BiPayload {
  readonly chartType: "bar" | "line";
  readonly title?: string;
  readonly dataSource: DataSource;
  readonly xAxis: AxisConfig;
  readonly yAxis: AxisConfig;
  readonly series: ReadonlyArray<SeriesConfig>;
}

export interface DataSource {
  readonly metrics: ReadonlyArray<string>;
  readonly dimensions: ReadonlyArray<string>;
  readonly filters?: ReadonlyArray<Filter>;
  readonly sort?: SortConfig;
}

export interface Filter {
  readonly field: string;
  readonly operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "in";
  readonly value: unknown;
}

export interface SortConfig {
  readonly field: string;
  readonly order: "asc" | "desc";
}

export interface AxisConfig {
  readonly field: string;
  readonly label?: string;
}

export interface SeriesConfig {
  readonly name: string;
  readonly field: string;
  readonly color?: string;
}

// ---------------------------------------------------------------------------
// ECharts option — the compilation target
// ---------------------------------------------------------------------------

export interface EChartsOption {
  readonly title?: { readonly text: string };
  readonly xAxis: EChartsAxis;
  readonly yAxis: EChartsAxis;
  readonly series: ReadonlyArray<EChartsSeries>;
  readonly legend?: { readonly data: ReadonlyArray<string> };
}

export interface EChartsAxis {
  readonly type: "category" | "value";
  readonly name?: string;
  readonly data?: ReadonlyArray<string>;
}

export interface EChartsSeries {
  readonly type: "bar" | "line";
  readonly name: string;
  readonly encode: {
    readonly x: string;
    readonly y: string;
  };
  readonly itemStyle?: { readonly color?: string };
}

// ---------------------------------------------------------------------------
// BI behavioral fingerprint — what we compare
// ---------------------------------------------------------------------------

/** API-level fingerprint: what data was requested. */
export interface ApiFingerprint {
  readonly metrics: ReadonlyArray<string>;
  readonly dimensions: ReadonlyArray<string>;
  readonly filters: ReadonlyArray<{
    readonly field: string;
    readonly operator: string;
  }>;
  readonly sort?: { readonly field: string; readonly order: string };
}

/** Render-level fingerprint: how data was visualized. */
export interface RenderFingerprint {
  readonly chartType: string;
  readonly seriesCount: number;
  readonly seriesTypes: ReadonlyArray<string>;
  readonly xAxisType: string;
  readonly yAxisType: string;
  readonly hasTitle: boolean;
  readonly hasLegend: boolean;
}

/** The full BI behavioral fingerprint. */
export interface BiFingerprint {
  readonly api: ApiFingerprint;
  readonly render: RenderFingerprint;
}
