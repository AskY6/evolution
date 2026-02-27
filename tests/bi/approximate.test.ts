import { describe, it, expect } from "vitest";
import { BiApproximate } from "../../packages/bi/src/approximate.js";
import { MockLLMProvider } from "../../packages/bi/src/llm.js";
import type { Schema, Demonstration } from "@evolution/core";
import { isLeft, isRight } from "@evolution/core";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const schema: Schema = {
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

function queryDemo(query: string): Demonstration {
  return {
    id: "test-demo",
    timestamp: new Date().toISOString(),
    source: { type: "user_query", raw: query },
    observedBehavior: { fingerprint: {} },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BiApproximate", () => {
  it("parses a valid LLM JSON response into an Instance", async () => {
    const mockResponse = JSON.stringify({
      chartType: "bar",
      title: "Monthly Revenue",
      dataSource: { metrics: ["revenue"], dimensions: ["month"] },
      xAxis: { field: "month" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    });

    const approx = new BiApproximate(new MockLLMProvider([mockResponse]));
    const result = await approx.approximate(schema, queryDemo("Show monthly revenue as a bar chart"));

    expect(isRight(result)).toBe(true);
    if (!isRight(result)) return;

    expect(result.right.schemaId).toBe("bi");
    expect(result.right.schemaVersion).toBe("0.1.0");
    expect(result.right.payload.chartType).toBe("bar");
    expect(result.right.payload.title).toBe("Monthly Revenue");
  });

  it("handles markdown-fenced JSON responses", async () => {
    const fencedResponse = '```json\n{"chartType":"line","dataSource":{"metrics":["count"],"dimensions":["day"]},"xAxis":{"field":"day"},"yAxis":{"field":"count"},"series":[{"name":"Count","field":"count"}]}\n```';

    const approx = new BiApproximate(new MockLLMProvider([fencedResponse]));
    const result = await approx.approximate(schema, queryDemo("Daily counts as line chart"));

    expect(isRight(result)).toBe(true);
    if (!isRight(result)) return;
    expect(result.right.payload.chartType).toBe("line");
  });

  it("returns Left for invalid JSON response", async () => {
    const approx = new BiApproximate(new MockLLMProvider(["This is not JSON at all"]));
    const result = await approx.approximate(schema, queryDemo("anything"));

    expect(isLeft(result)).toBe(true);
    if (!isLeft(result)) return;
    expect(result.left.kind).toBe("approximate");
    expect(result.left.message).toContain("Failed to parse");
  });

  it("returns Left when LLM provider throws", async () => {
    const failProvider = new MockLLMProvider([]); // no responses → throws
    const approx = new BiApproximate(failProvider);
    const result = await approx.approximate(schema, queryDemo("anything"));

    expect(isLeft(result)).toBe(true);
    if (!isLeft(result)) return;
    expect(result.left.kind).toBe("approximate");
  });

  it("extracts query from demonstration source.raw string", async () => {
    const mockResponse = JSON.stringify({
      chartType: "bar",
      dataSource: { metrics: ["sales"], dimensions: ["product"] },
      xAxis: { field: "product" },
      yAxis: { field: "sales" },
      series: [{ name: "Sales", field: "sales" }],
    });

    const approx = new BiApproximate(new MockLLMProvider([mockResponse]));
    const demo: Demonstration = {
      id: "test",
      timestamp: new Date().toISOString(),
      source: { type: "user_query", raw: "Sales by product" },
      observedBehavior: { fingerprint: {} },
    };

    const result = await approx.approximate(schema, demo);
    expect(isRight(result)).toBe(true);
  });

  it("extracts query from demonstration source.raw object with query field", async () => {
    const mockResponse = JSON.stringify({
      chartType: "bar",
      dataSource: { metrics: ["x"], dimensions: ["y"] },
      xAxis: { field: "y" },
      yAxis: { field: "x" },
      series: [{ name: "X", field: "x" }],
    });

    const approx = new BiApproximate(new MockLLMProvider([mockResponse]));
    const demo: Demonstration = {
      id: "test",
      timestamp: new Date().toISOString(),
      source: { type: "api", raw: { query: "Bar chart of x by y" } },
      observedBehavior: { fingerprint: {} },
    };

    const result = await approx.approximate(schema, demo);
    expect(isRight(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Full chain: approximate → compile → execute
// ---------------------------------------------------------------------------

describe("BiApproximate — full chain", () => {
  it("approximate → compile → execute produces a valid fingerprint", async () => {
    const { BiAdapter } = await import("../../packages/bi/src/adapter.js");

    const mockResponse = JSON.stringify({
      chartType: "bar",
      title: "Revenue by Region",
      dataSource: { metrics: ["revenue"], dimensions: ["region"] },
      xAxis: { field: "region", label: "Region" },
      yAxis: { field: "revenue", label: "Revenue ($)" },
      series: [{ name: "Revenue", field: "revenue", color: "#5470c6" }],
    });

    const approx = new BiApproximate(new MockLLMProvider([mockResponse]));
    const adapter = new BiAdapter();

    // Step 1: approximate
    const parseResult = await approx.approximate(schema, queryDemo("Show revenue by region as a bar chart"));
    expect(isRight(parseResult)).toBe(true);
    if (!isRight(parseResult)) return;

    // Step 2: compile
    const compileResult = adapter.compile(parseResult.right);
    expect(isRight(compileResult)).toBe(true);
    if (!isRight(compileResult)) return;
    expect(compileResult.right.format).toBe("echarts");

    // Step 3: execute
    const execResult = adapter.execute(compileResult.right);
    expect(isRight(execResult)).toBe(true);
    if (!isRight(execResult)) return;

    const fp = execResult.right.fingerprint as Record<string, unknown>;
    expect(fp.render).toBeDefined();
    expect(fp.api).toBeDefined();
  });
});
