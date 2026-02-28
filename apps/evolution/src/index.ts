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

import { SchemaRegistry, runEvolution } from "@evolution/core";
import type { Schema, Memory, ConvergenceConfig } from "@evolution/core";
import { BiAdapter, BiApproximate, BiExtend } from "@evolution/bi";
import type { LLM } from "@evolution/bi";
import { createOpenRouterLLM, createMockLLM } from "./llm.js";
import { createServer } from "./server.js";
import { biSchemaV010 } from "./schema.js";

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function createLLM(): LLM {
  if (process.env.MOCK === "1") {
    console.log("Using mock LLM");
    return createMockLLM([
      // Mock approximate response
      JSON.stringify({
        chartType: "bar",
        title: "Sample Chart",
        dataSource: { metrics: ["value"], dimensions: ["category"] },
        xAxis: { field: "category" },
        yAxis: { field: "value" },
        series: [{ name: "Value", field: "value" }],
      }),
      // Mock extend response
      JSON.stringify({
        extension: {
          id: "add-mock-field",
          description: "Mock extension for testing",
          newFields: [],
          newRules: [],
        },
        basePayload: {
          chartType: "bar",
          dataSource: { metrics: ["value"], dimensions: ["category"] },
          xAxis: { field: "category" },
          yAxis: { field: "value" },
          series: [{ name: "Value", field: "value" }],
        },
        extensionPayload: {},
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

function createInitialMemory(schema: Schema): Memory {
  return {
    currentSchema: schema,
    schemaHistory: [schema],
    records: [],
  };
}

function main(): void {
  const registry = new SchemaRegistry();
  registry.load(biSchemaV010);

  const schema = registry.current();
  const adapter = new BiAdapter();
  const llm = createLLM();
  const approximate = new BiApproximate(llm);
  const extend = new BiExtend(llm);
  let memory = createInitialMemory(schema);

  const convergenceConfig: ConvergenceConfig = {
    maxIterations: 5,
    gapThreshold: 2, // Moderate or below = converged
  };

  const port = parseInt(process.env.PORT ?? "3000", 10);
  const server = createServer({
    schema,
    adapter,
    approximate,
    extend,
    getMemory: () => memory,
    setMemory: (m: Memory) => { memory = m; },
    convergenceConfig,
  });

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
    console.log(`  POST /evolve   — { "query": "...", "observed": {...} } → EvolutionResult`);
    console.log();
    console.log("Example:");
    console.log(`  curl -X POST http://localhost:${port}/generate \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"query": "Show monthly revenue as a bar chart"}'`);
  });
}

main();
