import { describe, it, expect } from "vitest";
import { BiAdapter } from "../../packages/bi/src/adapter.js";
import type { EChartsOption, BiFingerprint } from "../../packages/bi/src/types.js";
import type { Instance, CandidateInstance } from "@evolution/core";
import { isLeft, isRight, Supportability } from "@evolution/core";
import instances from "../../knowledge/schemas/v0.1.0/instances.json" with { type: "json" };

const adapter = new BiAdapter();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function biInstance(payload: Record<string, unknown>): Instance {
  return { schemaId: "bi", schemaVersion: "0.1.0", payload };
}

// ---------------------------------------------------------------------------
// compile — Instance → ECharts Option
// ---------------------------------------------------------------------------

describe("BiAdapter.compile", () => {
  it("compiles a simple bar chart to ECharts option", () => {
    const result = adapter.compile(biInstance({
      chartType: "bar",
      title: "Revenue",
      dataSource: { metrics: ["revenue"], dimensions: ["month"] },
      xAxis: { field: "month", label: "Month" },
      yAxis: { field: "revenue", label: "Revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    }));

    expect(isRight(result)).toBe(true);
    if (!isRight(result)) return;

    expect(result.right.format).toBe("echarts");
    const option = result.right.artifact as EChartsOption;
    expect(option.title?.text).toBe("Revenue");
    expect(option.xAxis.type).toBe("category");
    expect(option.yAxis.type).toBe("value");
    expect(option.series.length).toBe(1);
    expect(option.series[0].type).toBe("bar");
    expect(option.series[0].encode.x).toBe("month");
    expect(option.series[0].encode.y).toBe("revenue");
  });

  it("compiles a line chart", () => {
    const result = adapter.compile(biInstance({
      chartType: "line",
      dataSource: { metrics: ["count"], dimensions: ["day"] },
      xAxis: { field: "day" },
      yAxis: { field: "count" },
      series: [{ name: "Count", field: "count" }],
    }));

    expect(isRight(result)).toBe(true);
    if (!isRight(result)) return;
    const option = result.right.artifact as EChartsOption;
    expect(option.series[0].type).toBe("line");
  });

  it("includes legend for multi-series charts", () => {
    const result = adapter.compile(biInstance({
      chartType: "bar",
      dataSource: { metrics: ["revenue", "cost"], dimensions: ["q"] },
      xAxis: { field: "q" },
      yAxis: { field: "revenue" },
      series: [
        { name: "Revenue", field: "revenue" },
        { name: "Cost", field: "cost" },
      ],
    }));

    expect(isRight(result)).toBe(true);
    if (!isRight(result)) return;
    const option = result.right.artifact as EChartsOption;
    expect(option.legend).toBeDefined();
    expect(option.legend!.data).toEqual(["Revenue", "Cost"]);
  });

  it("applies series color as itemStyle", () => {
    const result = adapter.compile(biInstance({
      chartType: "bar",
      dataSource: { metrics: ["x"], dimensions: ["y"] },
      xAxis: { field: "y" },
      yAxis: { field: "x" },
      series: [{ name: "X", field: "x", color: "#ff0000" }],
    }));

    expect(isRight(result)).toBe(true);
    if (!isRight(result)) return;
    const option = result.right.artifact as EChartsOption;
    expect(option.series[0].itemStyle?.color).toBe("#ff0000");
  });

  it("returns Left for missing chartType", () => {
    const result = adapter.compile(biInstance({
      dataSource: { metrics: ["x"], dimensions: ["y"] },
      xAxis: { field: "y" },
      yAxis: { field: "x" },
      series: [{ name: "X", field: "x" }],
    }));

    expect(isLeft(result)).toBe(true);
  });

  it("returns Left for empty series", () => {
    const result = adapter.compile(biInstance({
      chartType: "bar",
      dataSource: { metrics: ["x"], dimensions: ["y"] },
      xAxis: { field: "y" },
      yAxis: { field: "x" },
      series: [],
    }));

    expect(isLeft(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// compileC — CandidateInstance → CompileResult
// ---------------------------------------------------------------------------

describe("BiAdapter.compileC", () => {
  it("returns Compiled for supported chart types", () => {
    const candidate: CandidateInstance = {
      schemaId: "bi",
      schemaVersion: "0.1.0",
      basePayload: {
        chartType: "bar",
        dataSource: { metrics: ["x"], dimensions: ["y"] },
        xAxis: { field: "y" },
        yAxis: { field: "x" },
        series: [{ name: "X", field: "x" }],
      },
      extensionPayload: {},
    };
    const result = adapter.compileC(candidate);
    expect(result.kind).toBe("compiled");
  });

  it("returns Blocked for unfeasible chart types (radar)", () => {
    const candidate: CandidateInstance = {
      schemaId: "bi",
      schemaVersion: "0.1.0",
      basePayload: {},
      extensionPayload: {
        chartType: "radar",
        dataSource: { metrics: ["x"], dimensions: ["y"] },
        xAxis: { field: "y" },
        yAxis: { field: "x" },
        series: [{ name: "X", field: "x" }],
      },
    };
    const result = adapter.compileC(candidate);
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.constraints.some((c) => c.feature === "chart:radar")).toBe(true);
    }
  });

  it("returns Degraded for feasible-but-not-yet-supported features (pie)", () => {
    const candidate: CandidateInstance = {
      schemaId: "bi",
      schemaVersion: "0.1.0",
      basePayload: {},
      extensionPayload: {
        chartType: "pie",
        dataSource: { metrics: ["x"], dimensions: ["y"] },
        xAxis: { field: "y" },
        yAxis: { field: "x" },
        series: [{ name: "X", field: "x" }],
      },
    };
    const result = adapter.compileC(candidate);
    expect(result.kind).toBe("degraded");
    if (result.kind === "degraded") {
      expect(result.executable).toBeDefined();
      expect(result.missing.some((c) => c.feature === "chart:pie")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// execute — Executable → Behavior
// ---------------------------------------------------------------------------

describe("BiAdapter.execute", () => {
  it("produces a behavioral fingerprint from an ECharts option", () => {
    const compileResult = adapter.compile(biInstance({
      chartType: "bar",
      title: "Test",
      dataSource: { metrics: ["revenue"], dimensions: ["month"] },
      xAxis: { field: "month" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue" }],
    }));

    expect(isRight(compileResult)).toBe(true);
    if (!isRight(compileResult)) return;

    const execResult = adapter.execute(compileResult.right);
    expect(isRight(execResult)).toBe(true);
    if (!isRight(execResult)) return;

    const fp = execResult.right.fingerprint as unknown as BiFingerprint;
    expect(fp.api.metrics).toEqual(["revenue"]);
    expect(fp.api.dimensions).toEqual(["month"]);
    expect(fp.render.chartType).toBe("bar");
    expect(fp.render.seriesCount).toBe(1);
    expect(fp.render.hasTitle).toBe(true);
  });

  it("rejects non-echarts format", () => {
    const result = adapter.execute({ format: "svg", artifact: {} });
    expect(isLeft(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fingerprint — raw expert output → Behavior
// ---------------------------------------------------------------------------

describe("BiAdapter.fingerprint", () => {
  it("extracts fingerprint from a raw ECharts option object", () => {
    const rawExpertOption: EChartsOption = {
      title: { text: "Expert Chart" },
      xAxis: { type: "category", data: ["Jan", "Feb", "Mar"] },
      yAxis: { type: "value" },
      series: [
        { type: "bar", name: "Sales", encode: { x: "month", y: "sales" } },
        { type: "bar", name: "Profit", encode: { x: "month", y: "profit" } },
      ],
      legend: { data: ["Sales", "Profit"] },
    };

    const behavior = adapter.fingerprint(rawExpertOption);
    const fp = behavior.fingerprint as unknown as BiFingerprint;

    expect(fp.render.chartType).toBe("bar");
    expect(fp.render.seriesCount).toBe(2);
    expect(fp.render.hasTitle).toBe(true);
    expect(fp.render.hasLegend).toBe(true);
    expect(fp.api.metrics).toEqual(["sales", "profit"]);
    expect(fp.api.dimensions).toEqual(["Jan", "Feb", "Mar"]);
  });
});

// ---------------------------------------------------------------------------
// runtime — capability declaration
// ---------------------------------------------------------------------------

describe("BiAdapter.runtime", () => {
  it("declares bar and line as supported", () => {
    const cap = adapter.runtime();
    const bar = cap.features.find((f) => f.name === "chart:bar");
    const line = cap.features.find((f) => f.name === "chart:line");
    expect(bar?.supportability).toBe(Supportability.Supported);
    expect(line?.supportability).toBe(Supportability.Supported);
  });

  it("declares pie as feasible", () => {
    const cap = adapter.runtime();
    const pie = cap.features.find((f) => f.name === "chart:pie");
    expect(pie?.supportability).toBe(Supportability.Feasible);
  });

  it("declares radar as unfeasible", () => {
    const cap = adapter.runtime();
    const radar = cap.features.find((f) => f.name === "chart:radar");
    expect(radar?.supportability).toBe(Supportability.Unfeasible);
  });
});

// ---------------------------------------------------------------------------
// Full chain: Instance → compile → execute → fingerprint comparison
// ---------------------------------------------------------------------------

describe("BiAdapter — full chain", () => {
  it("compile → execute produces consistent fingerprint", () => {
    const instance = biInstance({
      chartType: "bar",
      title: "Chain Test",
      dataSource: { metrics: ["revenue"], dimensions: ["region"] },
      xAxis: { field: "region" },
      yAxis: { field: "revenue" },
      series: [{ name: "Revenue", field: "revenue", color: "#5470c6" }],
    });

    // compile
    const compiled = adapter.compile(instance);
    expect(isRight(compiled)).toBe(true);
    if (!isRight(compiled)) return;

    // execute
    const executed = adapter.execute(compiled.right);
    expect(isRight(executed)).toBe(true);
    if (!isRight(executed)) return;

    // fingerprint from the same option (simulating expert output)
    const expertBehavior = adapter.fingerprint(compiled.right.artifact);

    // System and expert behaviors should match
    expect(executed.right.fingerprint).toEqual(expertBehavior.fingerprint);
  });

  it("processes all 8 sample instances from knowledge/schemas/v0.1.0/", () => {
    expect(instances.length).toBe(8);

    for (const raw of instances) {
      const instance: Instance = {
        schemaId: raw.schemaId,
        schemaVersion: raw.schemaVersion,
        payload: raw.payload,
      };

      // compile
      const compiled = adapter.compile(instance);
      expect(isRight(compiled), `Compile failed for: ${(raw as Record<string, unknown>)._description}`).toBe(true);
      if (!isRight(compiled)) continue;

      // execute
      const executed = adapter.execute(compiled.right);
      expect(isRight(executed), `Execute failed for: ${(raw as Record<string, unknown>)._description}`).toBe(true);
      if (!isRight(executed)) continue;

      // Fingerprint should have api and render sections
      const fp = executed.right.fingerprint as unknown as BiFingerprint;
      expect(fp.api).toBeDefined();
      expect(fp.render).toBeDefined();
      expect(fp.render.chartType).toBe(instance.payload.chartType);
    }
  });
});
