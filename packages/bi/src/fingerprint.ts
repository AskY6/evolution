/**
 * BI-specific Gap severity assessment — path-based severity rules.
 *
 * The generic comparator produces a Gap with severity based on discrepancy
 * count heuristics. BI needs domain-specific severity based on *which*
 * fingerprint paths diverge (e.g. chartType mismatch is always Critical).
 *
 * Severity rules (path prefix → severity):
 *
 * | Path prefix                 | Severity | Reason                                |
 * |-----------------------------|----------|---------------------------------------|
 * | render.chartType            | Critical | Fundamental visualization paradigm    |
 * | api.metrics                 | Critical | Wrong data = wrong conclusions        |
 * | api.dimensions              | Major    | Wrong grouping = wrong analysis       |
 * | render.xAxisType/yAxisType  | Major    | Changes data interpretation           |
 * | render.seriesCount/Types    | Moderate | Affects data coverage                 |
 * | api.filters / api.sort      | Moderate | Affects data scope/ordering           |
 * | render.hasTitle/hasLegend   | Minor    | Cosmetic                              |
 * | Unknown paths               | Moderate | Default                               |
 */

import type { Gap } from "@evolution/core";
import { Severity } from "@evolution/core";

// ---------------------------------------------------------------------------
// Severity assessment result
// ---------------------------------------------------------------------------

/** Result of BI-specific severity assessment for a Gap. */
export interface BiSeverityAssessment {
  readonly severity: Severity;
  readonly pathSeverities: ReadonlyArray<{
    readonly path: string;
    readonly severity: Severity;
  }>;
}

// ---------------------------------------------------------------------------
// Path → Severity rules (ordered by priority, most specific first)
// ---------------------------------------------------------------------------

const PATH_SEVERITY_RULES: ReadonlyArray<{
  prefix: string;
  severity: Severity;
}> = [
  // Critical — fundamental paradigm or data correctness
  { prefix: "render.chartType", severity: Severity.Critical },
  { prefix: "api.metrics", severity: Severity.Critical },
  // Major — structural interpretation
  { prefix: "api.dimensions", severity: Severity.Major },
  { prefix: "render.xAxisType", severity: Severity.Major },
  { prefix: "render.yAxisType", severity: Severity.Major },
  // Moderate — data coverage and scope
  { prefix: "render.seriesCount", severity: Severity.Moderate },
  { prefix: "render.seriesTypes", severity: Severity.Moderate },
  { prefix: "api.filters", severity: Severity.Moderate },
  { prefix: "api.sort", severity: Severity.Moderate },
  // Minor — cosmetic
  { prefix: "render.hasTitle", severity: Severity.Minor },
  { prefix: "render.hasLegend", severity: Severity.Minor },
];

// ---------------------------------------------------------------------------
// Severity ordinal for comparison
// ---------------------------------------------------------------------------

const SEVERITY_ORDINAL: Record<Severity, number> = {
  [Severity.Minor]: 1,
  [Severity.Moderate]: 2,
  [Severity.Major]: 3,
  [Severity.Critical]: 4,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assess BI-specific severity for a Gap based on which fingerprint paths diverge.
 *
 * The overall severity is the maximum across all discrepancy paths.
 * If the gap has no discrepancies, severity is Minor.
 */
export function assessBiSeverity(gap: Gap): BiSeverityAssessment {
  const pathSeverities = gap.discrepancies.map((d) => ({
    path: d.path,
    severity: pathToSeverity(d.path),
  }));

  const maxSeverity = pathSeverities.reduce<Severity>(
    (max, ps) =>
      SEVERITY_ORDINAL[ps.severity] > SEVERITY_ORDINAL[max]
        ? ps.severity
        : max,
    Severity.Minor,
  );

  return { severity: maxSeverity, pathSeverities };
}

/**
 * Check whether a BI Gap is acceptable at the given severity threshold.
 *
 * @param gap - The gap to assess using BI-specific severity rules
 * @param threshold - Severity ordinal threshold (default 1 = only Minor is acceptable)
 * @returns true if the gap's BI-assessed severity ≤ threshold
 */
export function isBiGapAcceptable(gap: Gap, threshold: number = 1): boolean {
  const assessment = assessBiSeverity(gap);
  return SEVERITY_ORDINAL[assessment.severity] <= threshold;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function pathToSeverity(path: string): Severity {
  for (const rule of PATH_SEVERITY_RULES) {
    if (
      path === rule.prefix ||
      path.startsWith(rule.prefix + ".") ||
      path.startsWith(rule.prefix + "[")
    ) {
      return rule.severity;
    }
  }
  return Severity.Moderate; // Unknown paths default to Moderate
}
