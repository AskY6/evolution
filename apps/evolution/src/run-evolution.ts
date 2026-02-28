/**
 * CLI Evolution Runner — runs the full evolution pipeline step-by-step,
 * capturing intermediate results for case reporting.
 *
 * Usage:
 *   MOCK=1 node dist/run-evolution.js --case-id 001 --slug multi-series-comparison \
 *     --query "quarterly revenue vs cost comparison bar chart" \
 *     --observed '{"api":{...},"render":{...}}'
 *
 * Composes sub-pipelines individually (runApproximation → runExtension →
 * runCodification) instead of runEvolution(), because generateCaseReport()
 * needs ApproximationResult and ExtensionResult as separate inputs.
 *
 * Writes case files to knowledge/cases/{caseId}-{slug}/.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  SchemaRegistry,
  runApproximation,
  runExtension,
  runCodification,
  generateCaseReport,
  buildCaseFiles,
} from "@evolution/core";
import type { Memory, ConvergenceConfig, ApproximationResult, ExtensionResult } from "@evolution/core";
import { BiAdapter, BiApproximate, BiExtend } from "@evolution/bi";
import type { LLM } from "@evolution/bi";
import { createOpenRouterLLM, createMockLLM } from "./llm.js";
import { biSchemaV010 } from "./schema.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  caseId: string;
  slug: string;
  query: string;
  observed: Record<string, unknown>;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let caseId = "001";
  let slug = "unnamed";
  let query = "";
  let observed: Record<string, unknown> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--case-id":
        caseId = args[++i];
        break;
      case "--slug":
        slug = args[++i];
        break;
      case "--query":
        query = args[++i];
        break;
      case "--observed":
        observed = JSON.parse(args[++i]);
        break;
    }
  }

  if (!query) {
    console.error("Usage: node dist/run-evolution.js --case-id 001 --slug my-case --query '...' --observed '{...}'");
    process.exit(1);
  }

  return { caseId, slug, query, observed };
}

// ---------------------------------------------------------------------------
// LLM creation
// ---------------------------------------------------------------------------

function createLLM(): LLM {
  if (process.env.MOCK === "1") {
    console.log("[LLM] Using mock provider");
    return createMockLLM([
      // Approximate response: simple 1-series bar
      JSON.stringify({
        chartType: "bar",
        dataSource: { metrics: ["value"], dimensions: ["category"] },
        xAxis: { field: "category" },
        yAxis: { field: "value" },
        series: [{ name: "Value", field: "value" }],
      }),
      // Extend response: add field + corrected payload
      JSON.stringify({
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
          title: "Comparison Chart",
          dataSource: { metrics: ["revenue", "cost"], dimensions: ["quarter"] },
          xAxis: { field: "quarter" },
          yAxis: { field: "revenue" },
          series: [
            { name: "Revenue", field: "revenue" },
            { name: "Cost", field: "cost" },
          ],
        },
        extensionPayload: { comparisonMode: "side-by-side" },
      }),
    ]);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENROUTER_API_KEY is required (or set MOCK=1)");
    process.exit(1);
  }
  return createOpenRouterLLM({ apiKey, model: process.env.OPENROUTER_MODEL ?? undefined });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { caseId, slug, query, observed } = parseArgs();
  const caseName = `${caseId}-${slug}`;

  console.log(`\n=== Evolution Run: ${caseName} ===\n`);
  console.log(`Query: ${query}`);
  console.log(`Observed: ${JSON.stringify(observed).slice(0, 200)}...`);
  console.log();

  // Setup
  const registry = new SchemaRegistry();
  registry.load(biSchemaV010);
  const schema = registry.current();
  const adapter = new BiAdapter();
  const llm = createLLM();
  const approximate = new BiApproximate(llm);
  const extend = new BiExtend(llm);
  const memory: Memory = { currentSchema: schema, schemaHistory: [schema], records: [] };

  const convergenceConfig: ConvergenceConfig = {
    maxIterations: 5,
    gapThreshold: 2,
  };

  const demonstration = {
    id: `demo-${caseName}`,
    timestamp: new Date().toISOString(),
    source: { type: "user_query" as const, raw: query },
    observedBehavior: { fingerprint: observed },
  };

  // Phase A: Approximation
  console.log("--- Phase A: Approximation ---");
  const approxResult: ApproximationResult = await runApproximation({
    schema,
    demonstration,
    adapter,
    approximateAction: approximate,
  });
  console.log(`Result: ${approxResult.kind}`);

  if (approxResult.kind === "failed") {
    console.log(`Failed at ${approxResult.stage}: ${approxResult.message}`);
  }
  if (approxResult.kind === "insufficient") {
    console.log(`Gap severity: ${approxResult.gap.severity}`);
    console.log(`Discrepancies: ${approxResult.gap.discrepancies.length}`);
    for (const d of approxResult.gap.discrepancies) {
      console.log(`  - ${d.path}: ${d.type} (expected: ${JSON.stringify(d.expected)}, actual: ${JSON.stringify(d.actual)})`);
    }
  }
  console.log();

  // Phase B: Extension (if insufficient)
  let extResult: ExtensionResult | undefined;
  if (approxResult.kind === "insufficient") {
    console.log("--- Phase B: Extension ---");
    extResult = await runExtension({
      schema,
      gap: approxResult.gap,
      demonstration,
      adapter,
      extendAction: extend,
      config: convergenceConfig,
    });
    console.log(`Result: ${extResult.kind}`);

    if (extResult.kind === "converged") {
      console.log(`Converged in ${extResult.iterations} iteration(s)`);
      console.log(`Extensions: ${extResult.candidateSchema.extensions.map((e) => e.id).join(", ")}`);
    } else if (extResult.kind === "diverged") {
      console.log(`Diverged after ${extResult.iterations} iterations`);
    } else if (extResult.kind === "failed") {
      console.log(`Failed at ${extResult.stage}: ${extResult.message}`);
    }
    console.log();
  }

  // Phase C: Codification (if converged)
  let updatedMemory: Memory | undefined;
  if (extResult?.kind === "converged") {
    console.log("--- Phase C: Codification ---");
    const codifyResult = runCodification({
      memory,
      candidateSchema: extResult.candidateSchema,
      candidateInstance: extResult.candidateInstance,
      demonstrationId: demonstration.id,
      gap: approxResult.kind === "insufficient" ? approxResult.gap : undefined!,
      iterations: extResult.iterations,
    });

    if (codifyResult._tag === "Right") {
      updatedMemory = codifyResult.right;
      console.log(`Schema promoted: ${schema.version} → ${updatedMemory.currentSchema.version}`);
    } else {
      console.log(`Codification failed: ${codifyResult.left.message}`);
    }
    console.log();
  }

  // Generate report
  console.log("--- Case Report ---");
  const report = generateCaseReport({
    demonstrationId: demonstration.id,
    schemaBefore: schema,
    approximationResult: approxResult,
    extensionResult: extResult,
    updatedMemory,
  });

  console.log(`Outcome: ${report.outcome}`);
  console.log(`Summary: ${report.summary}`);
  console.log();

  // Write case files
  const caseFiles = buildCaseFiles(report);
  const caseDir = path.resolve("knowledge/cases", caseName);
  fs.mkdirSync(caseDir, { recursive: true });

  for (const [filename, content] of Object.entries(caseFiles)) {
    const filePath = path.join(caseDir, filename);
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`  Wrote: ${filePath}`);
  }

  console.log(`\nCase files written to ${caseDir}/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
