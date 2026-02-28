# Case 002: Radar Chart Unsupported — Escalated

- **Timestamp:** 2026-02-28T00:00:00Z
- **Demonstration:** demo-002-radar-chart-unsupported
- **Outcome:** escalated
- **Extension iterations:** 3

## Summary

Extension diverged after 3 iterations — escalated for human review.

An expert demonstrated a radar chart for multi-dimensional scoring. The base BI schema restricts `chartType` to `["bar", "line"]`, and the BI runtime declares `chart:radar` as `Unfeasible`. The extension pipeline attempted 3 iterations but could not bridge the fundamental gap: the compiler always reads `chartType` from the BiPayload, and since the schema enum forbids "radar", the compiled output always produces bar/line series types. The fingerprint mismatch (`render.chartType: "bar"` vs expected `"radar"`) persisted across all iterations.

## Expert Demonstration

- **Query:** "radar chart of scores by category"
- **Observed behavior:** Radar chart with `chartType: "radar"`, 1 series, metrics `[score]`, dimensions `[category]`

## Approximation Result

The LLM approximated the closest valid chart type (`"bar"`) since "radar" is not in the schema enum. This immediately produced a gap:

- `render.chartType`: value_mismatch (expected: "radar", actual: "bar")
- `render.seriesTypes[0]`: value_mismatch (expected: "radar", actual: "bar")

## Gap

- **Severity:** moderate
- **Source:** behavioral
- **Summary:** chartType fundamental mismatch — the schema lacks the concept of radar charts entirely.
- **Discrepancies:** 2+
  - `render.chartType`: value_mismatch (expected: "radar", actual: "bar")
  - `render.seriesTypes[0]`: value_mismatch (expected: "radar", actual: "bar")

## Extension Attempts

### Iteration 1
- **Extension:** add-radar-support-1
- **Approach:** Added `radarConfig` field to extension, kept `chartType: "bar"` in basePayload
- **Result:** Compiled successfully (bar chart), but fingerprint still shows `chartType: "bar"` — mismatch persists

### Iteration 2
- **Extension:** add-radar-support-2
- **Approach:** Added `radarConfig2` field, same base approach
- **Result:** Same fingerprint mismatch — the compiler reads chartType from BiPayload, which is constrained to bar/line

### Iteration 3
- **Extension:** add-radar-support-3
- **Approach:** Added `radarConfig3` field, exhausting iteration budget
- **Result:** Same fingerprint mismatch — diverged

## Why This Cannot Be Resolved by Extension Alone

The fundamental limitation is at two levels:

1. **Schema constraint:** `chartType` is an enum restricted to `["bar", "line"]`. Extensions can only ADD fields/rules — they cannot modify existing enum values. So no extension can make `chartType: "radar"` valid.

2. **Runtime constraint:** The BI runtime declares `chart:radar` as `Unfeasible` (no rendering engine support). Even if the schema allowed "radar", `compileC` would return `Blocked`.

3. **Compiler behavior:** `compileToECharts()` reads `payload.chartType` and sets every series' `type` to that value. Since `chartType` can only be "bar" or "line", the compiled ECharts option always has `series[].type: "bar"|"line"`, never "radar".

This is a correct escalation. Resolving it requires:
- Adding "radar" to the `chartType` enum (schema modification, not extension)
- Implementing radar chart rendering in the BI runtime (engineering effort)
- Extending the compiler to handle radar-specific ECharts options (polar coordinates, indicator axes)

## Schema

- **Before:** 0.1.0 (6 fields)
- **After:** (none — evolution did not succeed)
