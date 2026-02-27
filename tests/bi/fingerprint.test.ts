import { describe, it, expect } from "vitest";
import { assessBiSeverity, isBiGapAcceptable } from "../../packages/bi/src/fingerprint.js";
import type { Gap } from "@evolution/core";
import { Severity, DiscrepancyType, GapSource } from "@evolution/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGap(
  paths: string[],
  discrepancyType: DiscrepancyType = DiscrepancyType.ValueMismatch,
): Gap {
  return {
    source: GapSource.Behavioral,
    discrepancies: paths.map((path) => ({
      path,
      type: discrepancyType,
      expected: "x",
      actual: "y",
    })),
    severity: Severity.Moderate, // generic severity; BI assessment overrides
    summary: `${paths.length} discrepancies`,
  };
}

// ---------------------------------------------------------------------------
// assessBiSeverity — path-based severity
// ---------------------------------------------------------------------------

describe("assessBiSeverity", () => {
  it("rates render.chartType as Critical", () => {
    const result = assessBiSeverity(makeGap(["render.chartType"]));
    expect(result.severity).toBe(Severity.Critical);
    expect(result.pathSeverities[0].severity).toBe(Severity.Critical);
  });

  it("rates api.metrics as Critical", () => {
    const result = assessBiSeverity(makeGap(["api.metrics[0]"]));
    expect(result.severity).toBe(Severity.Critical);
  });

  it("rates api.dimensions as Major", () => {
    const result = assessBiSeverity(makeGap(["api.dimensions[0]"]));
    expect(result.severity).toBe(Severity.Major);
  });

  it("rates render.xAxisType as Major", () => {
    const result = assessBiSeverity(makeGap(["render.xAxisType"]));
    expect(result.severity).toBe(Severity.Major);
  });

  it("rates render.yAxisType as Major", () => {
    const result = assessBiSeverity(makeGap(["render.yAxisType"]));
    expect(result.severity).toBe(Severity.Major);
  });

  it("rates render.seriesCount as Moderate", () => {
    const result = assessBiSeverity(makeGap(["render.seriesCount"]));
    expect(result.severity).toBe(Severity.Moderate);
  });

  it("rates api.filters as Moderate", () => {
    const result = assessBiSeverity(makeGap(["api.filters[0].field"]));
    expect(result.severity).toBe(Severity.Moderate);
  });

  it("rates render.hasTitle as Minor", () => {
    const result = assessBiSeverity(makeGap(["render.hasTitle"]));
    expect(result.severity).toBe(Severity.Minor);
  });

  it("rates render.hasLegend as Minor", () => {
    const result = assessBiSeverity(makeGap(["render.hasLegend"]));
    expect(result.severity).toBe(Severity.Minor);
  });

  it("defaults unknown paths to Moderate", () => {
    const result = assessBiSeverity(makeGap(["unknown.field"]));
    expect(result.severity).toBe(Severity.Moderate);
  });

  it("returns max severity across multiple discrepancies", () => {
    // Minor (hasTitle) + Critical (chartType) → Critical overall
    const result = assessBiSeverity(
      makeGap(["render.hasTitle", "render.chartType"]),
    );
    expect(result.severity).toBe(Severity.Critical);
    expect(result.pathSeverities).toHaveLength(2);
  });

  it("returns Minor for empty gap", () => {
    const emptyGap: Gap = {
      source: GapSource.Behavioral,
      discrepancies: [],
      severity: Severity.Minor,
      summary: "Behaviors are equivalent.",
    };
    const result = assessBiSeverity(emptyGap);
    expect(result.severity).toBe(Severity.Minor);
    expect(result.pathSeverities).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isBiGapAcceptable — threshold logic
// ---------------------------------------------------------------------------

describe("isBiGapAcceptable", () => {
  it("accepts Minor gap at default threshold (1)", () => {
    expect(isBiGapAcceptable(makeGap(["render.hasTitle"]))).toBe(true);
  });

  it("rejects Moderate gap at default threshold (1)", () => {
    expect(isBiGapAcceptable(makeGap(["api.filters[0].field"]))).toBe(false);
  });

  it("accepts Moderate gap at threshold 2", () => {
    expect(isBiGapAcceptable(makeGap(["render.seriesCount"]), 2)).toBe(true);
  });

  it("rejects Critical gap at threshold 3 (Major)", () => {
    expect(isBiGapAcceptable(makeGap(["render.chartType"]), 3)).toBe(false);
  });

  it("accepts Critical gap at threshold 4", () => {
    expect(isBiGapAcceptable(makeGap(["render.chartType"]), 4)).toBe(true);
  });

  it("accepts empty gap at any threshold", () => {
    const emptyGap: Gap = {
      source: GapSource.Behavioral,
      discrepancies: [],
      severity: Severity.Minor,
      summary: "Behaviors are equivalent.",
    };
    expect(isBiGapAcceptable(emptyGap, 1)).toBe(true);
  });
});
