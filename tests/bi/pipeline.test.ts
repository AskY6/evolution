import { describe, it, expect } from "vitest";
import { runApproximation } from "@evolution/core";
import type { Schema, Demonstration, Behavior } from "@evolution/core";
import { BiAdapter } from "../../apps/workbench/src/bi/adapter";
import { BiApproximate } from "../../apps/workbench/src/bi/approximate";
import type { LLM } from "../../apps/workbench/src/bi/llm";
import type { BiFingerprint } from "../../apps/workbench/src/bi/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockLLM(responses: string[]): LLM {
  let i = 0;
  return async () => {
    if (i >= responses.length) throw new Error("No more responses");
    return responses[i++];
  };
}

const biSchema: Schema = {
  id: "bi",
  version: "0.1.0",
  fields: [
    { name: "chartType", description: "Chart type", type: { kind: "string", enum: ["bar", "line"] }, required: true },
    { name: "title", description: "Title", type: { kind: "string" }, required: false },
    {
      name: "dataSource", description: "Data source", type: {
        kind: "object", fields: [
          { name: "metrics", description: "Metrics", type: { kind: "array", element: { kind: "string" }, minItems: 1 }, required: true },
          { name: "dimensions", description: "Dimensions", type: { kind: "array", element: { kind: "string" }, minItems: 1 }, required: true },
        ],
      }, required: true,
    },
    {
      name: "xAxis", description: "X axis", type: {
        kind: "object", fields: [
          { name: "field", description: "Field", type: { kind: "string" }, required: true },
        ],
      }, required: true,
    },
    {
      name: "yAxis", description: "Y axis", type: {
        kind: "object", fields: [
          { name: "field", description: "Field", type: { kind: "string" }, required: true },
        ],
      }, required: true,
    },
    {
      name: "series", description: "Series", type: {
        kind: "array", element: {
          kind: "object", fields: [
            { name: "name", description: "Name", type: { kind: "string" }, required: true },
            { name: "field", description: "Field", type: { kind: "string" }, required: true },
          ],
        }, minItems: 1,
      }, required: true,
    },
  ],
  rules: [],
};

function makeObservedBehavior(fp: BiFingerprint): Behavior {
  return { fingerprint: fp as unknown as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Integration tests: real BiAdapter + mock LLM → full pipeline
// ---------------------------------------------------------------------------

describe("BI Approximation Pipeline (integration)", () => {
  it("returns Sufficient when LLM output matches observed behavior", async () => {
    const llmResponse = JSON.stringify({
      chartType: "bar",
      title: "Revenue",
      dataSource: { metrics: ["revenue"], dimensions: ["month"] },
      xAxis: { field: "month" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    });

    const adapter = new BiAdapter();
    const approx = new BiApproximate(mockLLM([llmResponse]));

    // Build the expected behavior by running the same payload through compile+execute
    // so that expected === actual (Sufficient)
    const tempInstance = {
      schemaId: "bi",
      schemaVersion: "0.1.0",
      payload: JSON.parse(llmResponse),
    };
    const compileResult = adapter.compile(tempInstance);
    if (compileResult._tag !== "Right") throw new Error("compile failed");
    const execResult = adapter.execute(compileResult.right);
    if (execResult._tag !== "Right") throw new Error("execute failed");
    const expectedBehavior = execResult.right;

    const demo: Demonstration = {
      id: "demo-1",
      timestamp: "2026-01-01T00:00:00Z",
      source: { type: "user_query", raw: "Show monthly revenue" },
      observedBehavior: expectedBehavior,
    };

    const result = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });

    expect(result.kind).toBe("sufficient");
    if (result.kind !== "sufficient") return;
    expect(result.instance.schemaId).toBe("bi");
  });

  it("returns Insufficient when observed behavior differs from pipeline output", async () => {
    const llmResponse = JSON.stringify({
      chartType: "bar",
      dataSource: { metrics: ["revenue"], dimensions: ["month"] },
      xAxis: { field: "month" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    });

    const adapter = new BiAdapter();
    const approx = new BiApproximate(mockLLM([llmResponse]));

    // Observed behavior has a different chartType → gap
    const observedBehavior = makeObservedBehavior({
      api: { metrics: ["revenue"], dimensions: ["month"], filters: [], sort: undefined },
      render: {
        chartType: "line", // Different from "bar"!
        seriesCount: 1,
        seriesTypes: ["line"],
        xAxisType: "category",
        yAxisType: "value",
        hasTitle: false,
        hasLegend: false,
      },
    });

    const demo: Demonstration = {
      id: "demo-2",
      timestamp: "2026-01-01T00:00:00Z",
      source: { type: "user_query", raw: "Show monthly revenue as a line chart" },
      observedBehavior: observedBehavior,
    };

    const result = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });

    expect(result.kind).toBe("insufficient");
    if (result.kind !== "insufficient") return;
    expect(result.gap.discrepancies.length).toBeGreaterThan(0);
    // The chartType discrepancy should be present
    const chartTypeDisc = result.gap.discrepancies.find(
      (d) => d.path === "render.chartType",
    );
    expect(chartTypeDisc).toBeDefined();
  });

  it("returns PipelineFailed when LLM produces invalid JSON", async () => {
    const adapter = new BiAdapter();
    const approx = new BiApproximate(mockLLM(["not valid json at all"]));

    const demo: Demonstration = {
      id: "demo-3",
      timestamp: "2026-01-01T00:00:00Z",
      source: { type: "user_query", raw: "anything" },
      observedBehavior: { fingerprint: {} },
    };

    const result = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.stage).toBe("approximate");
  });
});
