# Case 001: Multi-Series Comparison — Evolved

- **Timestamp:** 2026-02-28T00:00:00Z
- **Demonstration:** demo-001-multi-series-comparison
- **Outcome:** evolved
- **Extension iterations:** 1

## Summary

Schema evolved from 0.1.0 to 0.2.0 after 1 iteration(s).

An expert demonstrated a 2-series bar chart comparing quarterly revenue vs cost, with title and legend. The current schema (v0.1.0) could only approximate a single-series chart without title — producing 4+ discrepancies in the behavioral fingerprint. The extension pipeline proposed a `comparisonMode` field and corrected the base payload to include both series and a title. The compiled output matched the expert's behavior on the first attempt.

## Expert Demonstration

- **Query:** "quarterly revenue vs cost comparison bar chart"
- **Observed behavior:** 2-series bar chart with title "Revenue vs Cost", legend showing both series, metrics `[revenue, cost]`

## Approximation Result

The LLM approximation captured only a single series (`revenue`) with no title, producing a gap:

- `render.seriesCount`: value_mismatch (expected: 2, actual: 1)
- `render.hasTitle`: value_mismatch (expected: true, actual: false)
- `render.hasLegend`: value_mismatch (expected: true, actual: false)
- `api.metrics[1]`: missing (expected: "cost", actual: undefined)

## Gap

- **Severity:** critical
- **Source:** behavioral
- **Summary:** 4+ discrepancies including missing metric and structural differences.
- **Discrepancies:** 4+
  - `render.seriesCount`: value_mismatch (expected: 2, actual: 1)
  - `render.hasTitle`: value_mismatch (expected: true, actual: false)
  - `render.hasLegend`: value_mismatch (expected: true, actual: false)
  - `api.metrics[1]`: missing (expected: "cost", actual: undefined)

## Extension

- **Iterations:** 1
- **Extension ID:** add-comparison-mode
- **Description:** Add comparison mode for multi-series charts
- **New fields:** `comparisonMode` (string enum: side-by-side, stacked, overlay)
- **New rules:** none

The extension corrected the `basePayload` to include 2 series and a title, while adding `comparisonMode: "side-by-side"` in the `extensionPayload`. The `comparisonMode` field is semantically meaningful for the domain but transparent to the compiler — it gets added to the schema via codification for future use.

## Schema Change

- **Before:** 0.1.0 (6 fields)
- **After:** 0.2.0 (7 fields — added `comparisonMode`)

## Analysis

This case demonstrates the core evolution loop working end-to-end:

1. **Assimilation attempt fails** — the current schema can express bar charts but misses the multi-series comparison pattern
2. **Gap is precise** — the comparator identifies exactly what's wrong (series count, title, legend, metrics)
3. **Extension is minimal** — only adds `comparisonMode`, doesn't over-engineer
4. **Convergence is fast** — 1 iteration because the corrected payload matches immediately
5. **Codification is atomic** — schema version bumps cleanly from 0.1.0 to 0.2.0

The `comparisonMode` field represents genuine domain knowledge: experts distinguish between side-by-side, stacked, and overlay comparisons. This knowledge was not in the original schema but is now available for future approximations.
