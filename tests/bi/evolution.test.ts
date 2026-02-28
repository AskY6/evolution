/**
 * BI Evolution Integration Tests — end-to-end with real BiAdapter + mock LLM.
 *
 * Covers all 4 evolution outcomes:
 * A. Assimilated — schema sufficient, no extension needed
 * B. Evolved — gap found, extension converges, schema promoted
 * C. Escalated — gap found, extension diverges (runtime limitation)
 * D. Failed — LLM produces invalid JSON
 * E. Reporter — CaseReport generation from evolved result
 */

import { describe, it, expect } from "vitest";
import {
  runApproximation,
  runExtension,
  runCodification,
  generateCaseReport,
  buildCaseFiles,
} from "@evolution/core";
import type {
  Schema,
  Demonstration,
  Behavior,
  Memory,
  ConvergenceConfig,
  ApproximationResult,
  ExtensionResult,
} from "@evolution/core";
import { BiAdapter } from "../../packages/bi/src/adapter.js";
import { BiApproximate } from "../../packages/bi/src/approximate.js";
import { BiExtend } from "../../packages/bi/src/extend.js";
import type { LLM } from "../../packages/bi/src/llm.js";
import type { BiFingerprint } from "../../packages/bi/src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockLLM(responses: string[]): LLM {
  let i = 0;
  return async () => {
    if (i >= responses.length) throw new Error("No more mock responses");
    return responses[i++];
  };
}

function makeBehavior(fp: BiFingerprint): Behavior {
  return { fingerprint: fp as unknown as Record<string, unknown> };
}

function makeDemo(id: string, query: string, observed: Behavior): Demonstration {
  return {
    id,
    timestamp: "2026-02-28T00:00:00Z",
    source: { type: "user_query", raw: query },
    observedBehavior: observed,
  };
}

function makeMemory(schema: Schema): Memory {
  return { currentSchema: schema, schemaHistory: [schema], records: [] };
}

/** A minimal BI schema matching the full biSchemaV010 structure. */
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
          {
            name: "filters", description: "Filters", type: {
              kind: "array", element: {
                kind: "object", fields: [
                  { name: "field", description: "Field", type: { kind: "string" }, required: true },
                  { name: "operator", description: "Operator", type: { kind: "string", enum: ["=", "!=", ">", "<", ">=", "<=", "in"] }, required: true },
                  { name: "value", description: "Value", type: { kind: "union", variants: [{ kind: "string" }, { kind: "number" }, { kind: "boolean" }, { kind: "array", element: { kind: "string" } }] }, required: true },
                ],
              },
            }, required: false,
          },
          {
            name: "sort", description: "Sort", type: {
              kind: "object", fields: [
                { name: "field", description: "Field", type: { kind: "string" }, required: true },
                { name: "order", description: "Order", type: { kind: "string", enum: ["asc", "desc"] }, required: true },
              ],
            }, required: false,
          },
        ],
      }, required: true,
    },
    {
      name: "xAxis", description: "X axis", type: {
        kind: "object", fields: [
          { name: "field", description: "Field", type: { kind: "string" }, required: true },
          { name: "label", description: "Label", type: { kind: "string" }, required: false },
        ],
      }, required: true,
    },
    {
      name: "yAxis", description: "Y axis", type: {
        kind: "object", fields: [
          { name: "field", description: "Field", type: { kind: "string" }, required: true },
          { name: "label", description: "Label", type: { kind: "string" }, required: false },
        ],
      }, required: true,
    },
    {
      name: "series", description: "Series", type: {
        kind: "array", element: {
          kind: "object", fields: [
            { name: "name", description: "Name", type: { kind: "string" }, required: true },
            { name: "field", description: "Field", type: { kind: "string" }, required: true },
            { name: "color", description: "Color", type: { kind: "string" }, required: false },
          ],
        }, minItems: 1,
      }, required: true,
    },
  ],
  rules: [{ kind: "depends_on", field: "title", requires: "chartType" }],
};

const convergenceConfig: ConvergenceConfig = {
  maxIterations: 3,
  gapThreshold: 1, // Only Minor is acceptable
};

// ---------------------------------------------------------------------------
// Test A — Assimilated
// ---------------------------------------------------------------------------

describe("BI Evolution: Assimilated", () => {
  it("returns assimilated when LLM output matches expert behavior exactly", async () => {
    // Expert demonstrates a simple bar chart
    const payload = {
      chartType: "bar",
      dataSource: { metrics: ["revenue"], dimensions: ["quarter"] },
      xAxis: { field: "quarter" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    };

    const adapter = new BiAdapter();

    // Compute expected behavior by running the same payload through compile+execute
    const compileResult = adapter.compile({
      schemaId: "bi", schemaVersion: "0.1.0", payload,
    });
    expect(compileResult._tag).toBe("Right");
    if (compileResult._tag !== "Right") return;

    const execResult = adapter.execute(compileResult.right);
    expect(execResult._tag).toBe("Right");
    if (execResult._tag !== "Right") return;

    const expertBehavior = execResult.right;

    // LLM returns the exact same payload → behaviors will match
    const llm = mockLLM([JSON.stringify(payload)]);
    const approx = new BiApproximate(llm);

    const demo = makeDemo("assimilated-001", "Show quarterly revenue bar chart", expertBehavior);

    const result = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });

    expect(result.kind).toBe("sufficient");
    if (result.kind !== "sufficient") return;
    expect(result.instance.schemaId).toBe("bi");
    expect(result.instance.schemaVersion).toBe("0.1.0");
  });
});

// ---------------------------------------------------------------------------
// Test B — Evolved
// ---------------------------------------------------------------------------

describe("BI Evolution: Evolved", () => {
  it("evolves schema when extension bridges the gap", async () => {
    const adapter = new BiAdapter();

    // Expert demonstrates a 2-series bar chart with title (revenue vs cost)
    // Build the expected fingerprint directly
    const expertFingerprint: BiFingerprint = {
      api: {
        metrics: ["revenue", "cost"],
        dimensions: ["quarter"],
        filters: [],
        sort: undefined,
      },
      render: {
        chartType: "bar",
        seriesCount: 2,
        seriesTypes: ["bar"],
        xAxisType: "category",
        yAxisType: "value",
        hasTitle: true,
        hasLegend: true,
      },
    };
    const expertBehavior = makeBehavior(expertFingerprint);

    // LLM approximation only captures 1 series, no title → Gap
    const approximationPayload = {
      chartType: "bar",
      dataSource: { metrics: ["revenue"], dimensions: ["quarter"] },
      xAxis: { field: "quarter" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    };

    const approxLLM = mockLLM([JSON.stringify(approximationPayload)]);
    const approx = new BiApproximate(approxLLM);

    const demo = makeDemo(
      "evolved-001",
      "quarterly revenue vs cost comparison bar chart",
      expertBehavior,
    );

    // Phase A: Approximation → should be Insufficient
    const approxResult = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });

    expect(approxResult.kind).toBe("insufficient");
    if (approxResult.kind !== "insufficient") return;

    // Verify gap has multiple discrepancies
    expect(approxResult.gap.discrepancies.length).toBeGreaterThanOrEqual(2);

    // Extension LLM provides corrected basePayload with 2 series + title,
    // plus a new field `comparisonMode` in extensionPayload
    const extensionResponse = JSON.stringify({
      extension: {
        id: "add-comparison-mode",
        description: "Add comparison mode for multi-series charts",
        newFields: [{
          name: "comparisonMode",
          description: "How to compare multiple series",
          type: { kind: "string", enum: ["side-by-side", "stacked", "overlay"] },
          required: false,
        }],
        newRules: [],
      },
      basePayload: {
        chartType: "bar",
        title: "Revenue vs Cost",
        dataSource: { metrics: ["revenue", "cost"], dimensions: ["quarter"] },
        xAxis: { field: "quarter" },
        yAxis: { field: "revenue" },
        series: [
          { name: "Revenue", field: "revenue" },
          { name: "Cost", field: "cost" },
        ],
      },
      extensionPayload: {
        comparisonMode: "side-by-side",
      },
    });

    const extendLLM = mockLLM([extensionResponse]);
    const extend = new BiExtend(extendLLM);

    // Phase B: Extension → should Converge
    const extResult = await runExtension({
      schema: biSchema,
      gap: approxResult.gap,
      demonstration: demo,
      adapter,
      extendAction: extend,
      config: convergenceConfig,
    });

    expect(extResult.kind).toBe("converged");
    if (extResult.kind !== "converged") return;
    expect(extResult.iterations).toBe(1);
    expect(extResult.candidateSchema.extensions.length).toBe(1);
    expect(extResult.candidateSchema.extensions[0].id).toBe("add-comparison-mode");

    // Phase C: Codification → should produce updated Memory
    const memory = makeMemory(biSchema);
    const codifyResult = runCodification({
      memory,
      candidateSchema: extResult.candidateSchema,
      candidateInstance: extResult.candidateInstance,
      demonstrationId: demo.id,
      gap: approxResult.gap,
      iterations: extResult.iterations,
    });

    expect(codifyResult._tag).toBe("Right");
    if (codifyResult._tag !== "Right") return;

    const updatedMemory = codifyResult.right;
    expect(updatedMemory.currentSchema.version).toBe("0.2.0");
    expect(updatedMemory.currentSchema.fields.length).toBe(biSchema.fields.length + 1);

    // The new field should be present
    const newField = updatedMemory.currentSchema.fields.find((f) => f.name === "comparisonMode");
    expect(newField).toBeDefined();
    expect(newField!.description).toBe("How to compare multiple series");
  });
});

// ---------------------------------------------------------------------------
// Test C — Escalated
// ---------------------------------------------------------------------------

describe("BI Evolution: Escalated", () => {
  it("escalates when chart type mismatch cannot be resolved", async () => {
    const adapter = new BiAdapter();

    // Expert demonstrates a radar chart (unsupported by BI runtime)
    const expertFingerprint: BiFingerprint = {
      api: {
        metrics: ["score"],
        dimensions: ["category"],
        filters: [],
        sort: undefined,
      },
      render: {
        chartType: "radar",
        seriesCount: 1,
        seriesTypes: ["radar"],
        xAxisType: "category",
        yAxisType: "value",
        hasTitle: true,
        hasLegend: false,
      },
    };
    const expertBehavior = makeBehavior(expertFingerprint);

    // LLM approximation produces bar chart (closest it can do)
    const approximationPayload = {
      chartType: "bar",
      title: "Scores",
      dataSource: { metrics: ["score"], dimensions: ["category"] },
      xAxis: { field: "category" },
      yAxis: { field: "score" },
      series: [{ name: "Score", field: "score" }],
    };

    const approxLLM = mockLLM([JSON.stringify(approximationPayload)]);
    const approx = new BiApproximate(approxLLM);

    const demo = makeDemo(
      "escalated-001",
      "radar chart of scores by category",
      expertBehavior,
    );

    // Phase A: Approximation → Insufficient (chartType mismatch)
    const approxResult = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });

    expect(approxResult.kind).toBe("insufficient");
    if (approxResult.kind !== "insufficient") return;

    // chartType mismatch should be present
    const chartDisc = approxResult.gap.discrepancies.find(
      (d) => d.path === "render.chartType",
    );
    expect(chartDisc).toBeDefined();

    // Extension LLM tries to bridge the gap by adding new fields, but the
    // compiler always reads chartType from BiPayload — since the base schema
    // restricts chartType to ["bar", "line"], the compiled output always has
    // chartType "bar", never "radar". The fingerprint mismatch persists
    // across all iterations → Diverged.
    const makeExtensionResponse = (iter: number) => JSON.stringify({
      extension: {
        id: `add-radar-support-${iter}`,
        description: `Attempt ${iter}: Add radar chart support`,
        newFields: [{
          name: `radarConfig${iter > 1 ? iter : ""}`,
          description: "Radar chart configuration",
          type: { kind: "string" },
          required: false,
        }],
        newRules: [],
      },
      basePayload: {
        chartType: "bar", // Can only be "bar" or "line" per schema enum
        title: "Scores",
        dataSource: { metrics: ["score"], dimensions: ["category"] },
        xAxis: { field: "category" },
        yAxis: { field: "score" },
        series: [{ name: "Score", field: "score" }],
      },
      extensionPayload: {
        [`radarConfig${iter > 1 ? iter : ""}`]: "standard",
      },
    });

    const extendLLM = mockLLM([
      makeExtensionResponse(1),
      makeExtensionResponse(2),
      makeExtensionResponse(3),
    ]);
    const extend = new BiExtend(extendLLM);

    // Phase B: Extension → should Diverge (Blocked by runtime)
    const extResult = await runExtension({
      schema: biSchema,
      gap: approxResult.gap,
      demonstration: demo,
      adapter,
      extendAction: extend,
      config: convergenceConfig,
    });

    expect(extResult.kind).toBe("diverged");
    if (extResult.kind !== "diverged") return;
    expect(extResult.iterations).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Test D — Failed
// ---------------------------------------------------------------------------

describe("BI Evolution: Failed", () => {
  it("returns PipelineFailed when LLM produces invalid JSON", async () => {
    const adapter = new BiAdapter();
    const approx = new BiApproximate(mockLLM(["this is not valid JSON!!!"]));

    const demo = makeDemo(
      "failed-001",
      "some chart",
      { fingerprint: {} },
    );

    const result = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });

    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.stage).toBe("approximate");
    expect(result.message).toContain("Failed to parse LLM response");
  });
});

// ---------------------------------------------------------------------------
// Test E — Reporter integration
// ---------------------------------------------------------------------------

describe("BI Evolution: Reporter", () => {
  it("generates CaseReport with correct files for an evolved result", async () => {
    const adapter = new BiAdapter();

    // Build a minimal evolved scenario programmatically
    const expertFingerprint: BiFingerprint = {
      api: {
        metrics: ["revenue", "cost"],
        dimensions: ["quarter"],
        filters: [],
        sort: undefined,
      },
      render: {
        chartType: "bar",
        seriesCount: 2,
        seriesTypes: ["bar"],
        xAxisType: "category",
        yAxisType: "value",
        hasTitle: true,
        hasLegend: true,
      },
    };
    const expertBehavior = makeBehavior(expertFingerprint);

    // Approximation: 1-series only → insufficient
    const approxPayload = {
      chartType: "bar",
      dataSource: { metrics: ["revenue"], dimensions: ["quarter"] },
      xAxis: { field: "quarter" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    };

    const approxLLM = mockLLM([JSON.stringify(approxPayload)]);
    const approx = new BiApproximate(approxLLM);

    const demo = makeDemo("reporter-001", "revenue vs cost chart", expertBehavior);

    const approxResult: ApproximationResult = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });
    expect(approxResult.kind).toBe("insufficient");
    if (approxResult.kind !== "insufficient") return;

    // Extension: provides corrected payload → converges
    const extendResponse = JSON.stringify({
      extension: {
        id: "add-comparison-mode",
        description: "Multi-series comparison support",
        newFields: [{
          name: "comparisonMode",
          description: "Comparison display mode",
          type: { kind: "string" },
          required: false,
        }],
        newRules: [],
      },
      basePayload: {
        chartType: "bar",
        title: "Revenue vs Cost",
        dataSource: { metrics: ["revenue", "cost"], dimensions: ["quarter"] },
        xAxis: { field: "quarter" },
        yAxis: { field: "revenue" },
        series: [
          { name: "Revenue", field: "revenue" },
          { name: "Cost", field: "cost" },
        ],
      },
      extensionPayload: { comparisonMode: "side-by-side" },
    });

    const extendLLM = mockLLM([extendResponse]);
    const extend = new BiExtend(extendLLM);

    const extResult: ExtensionResult = await runExtension({
      schema: biSchema,
      gap: approxResult.gap,
      demonstration: demo,
      adapter,
      extendAction: extend,
      config: convergenceConfig,
    });
    expect(extResult.kind).toBe("converged");
    if (extResult.kind !== "converged") return;

    // Codification
    const memory = makeMemory(biSchema);
    const codifyResult = runCodification({
      memory,
      candidateSchema: extResult.candidateSchema,
      candidateInstance: extResult.candidateInstance,
      demonstrationId: demo.id,
      gap: approxResult.gap,
      iterations: extResult.iterations,
    });
    expect(codifyResult._tag).toBe("Right");
    if (codifyResult._tag !== "Right") return;

    // Generate report
    const report = generateCaseReport({
      demonstrationId: demo.id,
      schemaBefore: biSchema,
      approximationResult: approxResult,
      extensionResult: extResult,
      updatedMemory: codifyResult.right,
    });

    expect(report.outcome).toBe("evolved");
    expect(report.schemaBefore.version).toBe("0.1.0");
    expect(report.schemaAfter).toBeDefined();
    expect(report.schemaAfter!.version).toBe("0.2.0");
    expect(report.gap).toBeDefined();
    expect(report.extensionIterations).toBe(1);

    // Build case files
    const files = buildCaseFiles(report);
    expect(files["report.md"]).toContain("evolved");
    expect(files["schema-before.json"]).toContain("0.1.0");
    expect(files["schema-after.json"]).toContain("0.2.0");
    expect(files["gap.json"]).toBeDefined();

    // Verify gap.json contains discrepancies
    const gapData = JSON.parse(files["gap.json"]);
    expect(gapData.discrepancies.length).toBeGreaterThan(0);
  });

  it("generates correct report for assimilated outcome", async () => {
    const adapter = new BiAdapter();

    const payload = {
      chartType: "bar",
      dataSource: { metrics: ["revenue"], dimensions: ["quarter"] },
      xAxis: { field: "quarter" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    };

    const compileResult = adapter.compile({ schemaId: "bi", schemaVersion: "0.1.0", payload });
    if (compileResult._tag !== "Right") return;
    const execResult = adapter.execute(compileResult.right);
    if (execResult._tag !== "Right") return;

    const approxLLM = mockLLM([JSON.stringify(payload)]);
    const approx = new BiApproximate(approxLLM);
    const demo = makeDemo("reporter-002", "bar chart", execResult.right);

    const approxResult: ApproximationResult = await runApproximation({
      schema: biSchema,
      demonstration: demo,
      adapter,
      approximateAction: approx,
    });
    expect(approxResult.kind).toBe("sufficient");

    const report = generateCaseReport({
      demonstrationId: demo.id,
      schemaBefore: biSchema,
      approximationResult: approxResult,
    });

    expect(report.outcome).toBe("assimilated");
    expect(report.schemaAfter).toBeUndefined();
    expect(report.gap).toBeUndefined();

    const files = buildCaseFiles(report);
    expect(files["report.md"]).toContain("assimilated");
    expect(files["schema-before.json"]).toBeDefined();
    expect(files["schema-after.json"]).toBeUndefined();
    expect(files["gap.json"]).toBeUndefined();
  });
});
