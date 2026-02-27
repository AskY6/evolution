/**
 * Application entry point — assembles @evolution/core + @evolution/bi.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... node dist/index.js         # real LLM
 *   MOCK=1 node dist/index.js                            # mock LLM (dev/test)
 *
 * Environment variables:
 *   OPENROUTER_API_KEY — required for real LLM mode
 *   OPENROUTER_MODEL   — optional, defaults to anthropic/claude-sonnet-4
 *   PORT               — server port, defaults to 3000
 *   MOCK               — set to "1" to use mock LLM
 */

import { SchemaRegistry } from "@evolution/core";
import type { Schema } from "@evolution/core";
import { BiAdapter, BiApproximate } from "@evolution/bi";
import type { LLM } from "@evolution/bi";
import { createOpenRouterLLM, createMockLLM } from "./llm.js";
import { createServer } from "./server.js";

// ---------------------------------------------------------------------------
// Schema loading
// ---------------------------------------------------------------------------

const biSchemaV010: Schema = {
  id: "bi",
  version: "0.1.0",
  fields: [
    { name: "chartType", description: "Type of chart to render", type: { kind: "string", enum: ["bar", "line"] }, required: true },
    { name: "title", description: "Chart title text", type: { kind: "string" }, required: false },
    {
      name: "dataSource", description: "Data query configuration", type: {
        kind: "object", fields: [
          { name: "metrics", description: "Measure fields to aggregate", type: { kind: "array", element: { kind: "string" }, minItems: 1 }, required: true },
          { name: "dimensions", description: "Dimension fields to group by", type: { kind: "array", element: { kind: "string" }, minItems: 1 }, required: true },
          {
            name: "filters", description: "Data filter conditions", type: {
              kind: "array", element: {
                kind: "object", fields: [
                  { name: "field", description: "Field to filter on", type: { kind: "string" }, required: true },
                  { name: "operator", description: "Comparison operator", type: { kind: "string", enum: ["=", "!=", ">", "<", ">=", "<=", "in"] }, required: true },
                  { name: "value", description: "Filter value", type: { kind: "union", variants: [{ kind: "string" }, { kind: "number" }, { kind: "boolean" }, { kind: "array", element: { kind: "string" } }] }, required: true },
                ],
              },
            }, required: false,
          },
          {
            name: "sort", description: "Sort configuration", type: {
              kind: "object", fields: [
                { name: "field", description: "Field to sort by", type: { kind: "string" }, required: true },
                { name: "order", description: "Sort direction", type: { kind: "string", enum: ["asc", "desc"] }, required: true },
              ],
            }, required: false,
          },
        ],
      }, required: true,
    },
    {
      name: "xAxis", description: "X-axis configuration", type: {
        kind: "object", fields: [
          { name: "field", description: "Dimension field for x-axis", type: { kind: "string" }, required: true },
          { name: "label", description: "X-axis display label", type: { kind: "string" }, required: false },
        ],
      }, required: true,
    },
    {
      name: "yAxis", description: "Y-axis configuration", type: {
        kind: "object", fields: [
          { name: "field", description: "Metric field for y-axis", type: { kind: "string" }, required: true },
          { name: "label", description: "Y-axis display label", type: { kind: "string" }, required: false },
        ],
      }, required: true,
    },
    {
      name: "series", description: "Data series to display", type: {
        kind: "array", element: {
          kind: "object", fields: [
            { name: "name", description: "Series display name", type: { kind: "string" }, required: true },
            { name: "field", description: "Metric field for this series", type: { kind: "string" }, required: true },
            { name: "color", description: "Series color", type: { kind: "string" }, required: false },
          ],
        }, minItems: 1,
      }, required: true,
    },
  ],
  rules: [{ kind: "depends_on", field: "title", requires: "chartType" }],
};

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function createLLM(): LLM {
  if (process.env.MOCK === "1") {
    console.log("Using mock LLM");
    return createMockLLM([
      JSON.stringify({
        chartType: "bar",
        title: "Sample Chart",
        dataSource: { metrics: ["value"], dimensions: ["category"] },
        xAxis: { field: "category" },
        yAxis: { field: "value" },
        series: [{ name: "Value", field: "value" }],
      }),
    ]);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENROUTER_API_KEY is required (or set MOCK=1 for development)");
    process.exit(1);
  }

  const model = process.env.OPENROUTER_MODEL ?? undefined;
  console.log(`Using OpenRouter (model: ${model ?? "default"})`);
  return createOpenRouterLLM({ apiKey, model });
}

function main(): void {
  const registry = new SchemaRegistry();
  registry.load(biSchemaV010);

  const schema = registry.current();
  const adapter = new BiAdapter();
  const llm = createLLM();
  const approximate = new BiApproximate(llm);

  const port = parseInt(process.env.PORT ?? "3000", 10);
  const server = createServer({ schema, adapter, approximate });

  server.listen(port, () => {
    console.log(`Evolution server running on http://localhost:${port}`);
    console.log();
    console.log("Endpoints:");
    console.log(`  GET  /health   — health check`);
    console.log(`  GET  /schema   — current BI schema`);
    console.log(`  POST /parse    — { "query": "..." } → Instance`);
    console.log(`  POST /compile  — Instance → Executable (ECharts option)`);
    console.log(`  POST /execute  — Executable → Behavior (fingerprint)`);
    console.log(`  POST /generate — { "query": "..." } → Instance + ECharts option`);
    console.log();
    console.log("Example:");
    console.log(`  curl -X POST http://localhost:${port}/generate \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"query": "Show monthly revenue as a bar chart"}'`);
  });
}

main();
