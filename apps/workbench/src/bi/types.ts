/**
 * BI-specific types — Schema vocabulary, Dashboard compilation targets, fingerprint structures.
 *
 * BiSchema and BiExtension are the BI domain's concrete implementations of the
 * framework's Schema and Extension interfaces. They add field/rule structure that
 * the framework intentionally does not know about.
 *
 * Domain subject: a full Dashboard (multiple charts, grid layout, shared filters,
 * cross-chart data bindings), not a single chart.
 */

// ---------------------------------------------------------------------------
// BI Schema vocabulary — FieldType, FieldDefinition, Rule
// ---------------------------------------------------------------------------

/** Leaf type: string with optional constraints. */
export interface BiStringType {
  readonly kind: "string";
  readonly enum?: ReadonlyArray<string>;
}

/** Leaf type: number with optional range. */
export interface BiNumberType {
  readonly kind: "number";
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

/** Leaf type: boolean. */
export interface BiBooleanType {
  readonly kind: "boolean";
}

/** Composite type: nested object with its own fields. */
export interface BiObjectType {
  readonly kind: "object";
  readonly fields: ReadonlyArray<BiFieldDefinition>;
}

/** Collection type: ordered list of a single element type. */
export interface BiArrayType {
  readonly kind: "array";
  readonly element: BiFieldType;
  readonly minItems?: number;
  readonly maxItems?: number;
}

/** Union type: value must conform to exactly one of the variants. */
export interface BiUnionType {
  readonly kind: "union";
  readonly variants: ReadonlyArray<BiFieldType>;
}

/** All possible BI field type descriptors. */
export type BiFieldType =
  | BiStringType
  | BiNumberType
  | BiBooleanType
  | BiObjectType
  | BiArrayType
  | BiUnionType;

/** A single field that a BI Instance payload may (or must) contain. */
export interface BiFieldDefinition {
  readonly name: string;
  readonly description: string;
  readonly type: BiFieldType;
  readonly required: boolean;
  readonly defaultValue?: unknown;
}

/** Field A is required when field B has a specific value. */
export interface BiRequiredIfRule {
  readonly kind: "required_if";
  readonly field: string;
  readonly when: { readonly field: string; readonly equals: unknown };
}

/** At most one of these fields may be present. */
export interface BiMutualExclusiveRule {
  readonly kind: "mutual_exclusive";
  readonly fields: ReadonlyArray<string>;
}

/** Field A can only be present when field B is also present. */
export interface BiDependsOnRule {
  readonly kind: "depends_on";
  readonly field: string;
  readonly requires: string;
}

/** All possible BI rule types. */
export type BiRule = BiRequiredIfRule | BiMutualExclusiveRule | BiDependsOnRule;

// ---------------------------------------------------------------------------
// BiSchema — BI domain's concrete Schema (structurally extends Schema)
// ---------------------------------------------------------------------------

/**
 * BI-specific schema with field definitions and rules.
 *
 * Structurally satisfies the framework's Schema interface (has id + version),
 * and extends it with BI-specific vocabulary (fields + rules).
 */
export interface BiSchema {
  readonly id: string;
  readonly version: string;
  readonly fields: ReadonlyArray<BiFieldDefinition>;
  readonly rules: ReadonlyArray<BiRule>;
}

// ---------------------------------------------------------------------------
// BiExtension — BI domain's concrete Extension (structurally extends Extension)
// ---------------------------------------------------------------------------

/**
 * BI-specific schema extension with new fields and rules.
 *
 * Structurally satisfies the framework's Extension interface (has id + description),
 * and extends it with BI-specific additions (newFields + newRules).
 * At runtime, extensions are passed as Extension to the framework, and the
 * BiAdapter casts them back to BiExtension to access the extra properties.
 */
export interface BiExtension {
  readonly id: string;
  readonly description: string;
  readonly newFields: ReadonlyArray<BiFieldDefinition>;
  readonly newRules: ReadonlyArray<BiRule>;
}

// ---------------------------------------------------------------------------
// Dashboard payload structure — what a BI Instance contains
// ---------------------------------------------------------------------------

/** Grid position within the dashboard layout (1-based). */
export interface GridPosition {
  readonly col: number;
  readonly row: number;
  readonly colSpan: number;
  readonly rowSpan: number;
}

/** Dashboard grid layout dimensions. */
export interface GridLayout {
  readonly columns: number;
  readonly rows: number;
}

/** Data source configuration for a single chart. */
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

/** A single chart within the dashboard. */
export interface ChartConfig {
  readonly id: string;
  readonly chartType: "bar" | "line" | "pie";
  readonly title?: string;
  readonly position: GridPosition;
  readonly dataSource: DataSource;
  /** Optional for pie charts. */
  readonly xAxis?: AxisConfig;
  /** Optional for pie charts. */
  readonly yAxis?: AxisConfig;
  readonly series: ReadonlyArray<SeriesConfig>;
}

/**
 * Shared filter that applies across multiple charts.
 * applyTo: "all" means every chart; otherwise a list of chart ids.
 */
export interface SharedFilter {
  readonly field: string;
  readonly operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "in";
  readonly value: unknown;
  readonly applyTo: "all" | ReadonlyArray<string>;
}

/** Cross-chart interaction: clicking a data point in sourceChart filters targetChart. */
export interface DataBinding {
  readonly sourceChart: string;
  readonly sourceField: string;
  readonly targetChart: string;
  readonly targetFilter: string;
}

/**
 * Full Dashboard payload — the BI Instance payload.
 * Replaces the former single-chart BiPayload.
 */
export interface DashboardPayload {
  readonly title: string;
  readonly layout: GridLayout;
  readonly charts: ReadonlyArray<ChartConfig>;
  readonly sharedFilters?: ReadonlyArray<SharedFilter>;
  readonly dataBindings?: ReadonlyArray<DataBinding>;
}

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
  readonly position: GridPosition;
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
