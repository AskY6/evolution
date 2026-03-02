// @evolution/bi — BI domain use case
// "What to learn" — BI-specific implementation of DomainAdapter

export { BiAdapter } from "./adapter";
export { BiApproximate } from "./actions/approximate";
export { BiExtend } from "./actions/extend";
export type { LLM } from "./llm";
export type {
  BiSchema,
  BiExtension,
  BiFieldDefinition,
  BiFieldType,
  BiStringType,
  BiNumberType,
  BiBooleanType,
  BiObjectType,
  BiArrayType,
  BiUnionType,
  BiRule,
  BiRequiredIfRule,
  BiMutualExclusiveRule,
  BiDependsOnRule,
} from "./core/schema";
export { biSchemaV010 } from "./core/schema";
export type {
  DashboardPayload,
  GridLayout,
  GridPosition,
  ChartConfig,
  SharedFilter,
  DataBinding,
  DataSource,
  Filter,
  SortConfig,
  AxisConfig,
  SeriesConfig,
} from "./core/instance";
export type {
  EChartsOption,
  EChartsAxis,
  EChartsSeries,
  DashboardExecutable,
  DashboardPanel,
  DashboardFingerprint,
  ChartFingerprint,
} from "./core/renderer";
