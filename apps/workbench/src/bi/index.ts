// @evolution/bi — BI domain use case
// "What to learn" — BI-specific implementation of DomainAdapter

export { BiAdapter } from "./adapter";
export { BiApproximate } from "./approximate";
export { BiExtend } from "./extend";
export { assessBiSeverity, isBiGapAcceptable, type BiSeverityAssessment } from "./fingerprint";
export type { LLM } from "./llm";
export type {
  BiPayload,
  DataSource,
  Filter,
  SortConfig,
  AxisConfig,
  SeriesConfig,
  EChartsOption,
  EChartsAxis,
  EChartsSeries,
  BiFingerprint,
  ApiFingerprint,
  RenderFingerprint,
} from "./types";
