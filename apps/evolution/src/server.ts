/**
 * Minimal API server — parse → compile → execute → evolve endpoints.
 *
 * Uses Node built-in http module (no external dependencies).
 *
 * Endpoints:
 *   POST /parse         — { query: string } → Instance
 *   POST /compile       — Instance → Executable (ECharts option)
 *   POST /execute       — Executable → Behavior
 *   POST /generate      — { query: string } → ECharts option (combined pipeline)
 *   POST /evolve        — { query: string, observed: object } → EvolutionResult
 *   POST /evolve-report — { query: string, observed: object } → { result, report, caseFiles }
 *   GET  /health        — health check
 *   GET  /schema        — current schema
 */

import * as http from "node:http";
import type { Schema, Instance, Executable, ApproximateAction, DomainAdapter, Memory, ConvergenceConfig, ApproximationResult, ExtensionResult } from "@evolution/core";
import type { ExtendAction } from "@evolution/core";
import { isLeft, runEvolution, runApproximation, runExtension, runCodification, generateCaseReport, buildCaseFiles, EvolutionOutcome } from "@evolution/core";

export interface ServerDeps {
  readonly schema: Schema;
  readonly adapter: DomainAdapter;
  readonly approximate: ApproximateAction;
  readonly extend: ExtendAction;
  readonly getMemory: () => Memory;
  readonly setMemory: (memory: Memory) => void;
  readonly convergenceConfig: ConvergenceConfig;
}

export function createServer(deps: ServerDeps): http.Server {
  const { schema, adapter, approximate, extend, getMemory, setMemory, convergenceConfig } = deps;

  return http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

      if (req.method === "GET" && url.pathname === "/health") {
        json(res, 200, { status: "ok" });
        return;
      }

      if (req.method === "GET" && url.pathname === "/schema") {
        json(res, 200, getMemory().currentSchema);
        return;
      }

      if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }

      const body = await readBody(req);

      switch (url.pathname) {
        case "/parse":
          await handleParse(res, body, schema, approximate);
          break;
        case "/compile":
          handleCompile(res, body, adapter);
          break;
        case "/execute":
          handleExecute(res, body, adapter);
          break;
        case "/generate":
          await handleGenerate(res, body, schema, adapter, approximate);
          break;
        case "/evolve":
          await handleEvolve(res, body, adapter, approximate, extend, getMemory, setMemory, convergenceConfig);
          break;
        case "/evolve-report":
          await handleEvolveReport(res, body, schema, adapter, approximate, extend, getMemory, setMemory, convergenceConfig);
          break;
        default:
          json(res, 404, { error: `Unknown endpoint: ${url.pathname}` });
      }
    } catch (err) {
      console.error("Server error:", err);
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleParse(
  res: http.ServerResponse,
  body: unknown,
  schema: Schema,
  approximate: ApproximateAction,
): Promise<void> {
  const { query } = body as { query?: string };
  if (!query || typeof query !== "string") {
    json(res, 400, { error: "Missing 'query' string in request body" });
    return;
  }

  const demo = {
    id: `parse-${Date.now()}`,
    timestamp: new Date().toISOString(),
    source: { type: "user_query", raw: query },
    observedBehavior: { fingerprint: {} },
  };

  const result = await approximate.approximate(schema, demo);
  if (isLeft(result)) {
    json(res, 422, { error: "Parse failed", details: result.left });
    return;
  }
  json(res, 200, result.right);
}

function handleCompile(
  res: http.ServerResponse,
  body: unknown,
  adapter: DomainAdapter,
): void {
  const instance = body as Instance;
  const result = adapter.compile(instance);
  if (isLeft(result)) {
    json(res, 422, { error: "Compile failed", details: result.left });
    return;
  }
  json(res, 200, result.right);
}

function handleExecute(
  res: http.ServerResponse,
  body: unknown,
  adapter: DomainAdapter,
): void {
  const executable = body as Executable;
  const result = adapter.execute(executable);
  if (isLeft(result)) {
    json(res, 422, { error: "Execute failed", details: result.left });
    return;
  }
  json(res, 200, result.right);
}

async function handleGenerate(
  res: http.ServerResponse,
  body: unknown,
  schema: Schema,
  adapter: DomainAdapter,
  approximate: ApproximateAction,
): Promise<void> {
  const { query } = body as { query?: string };
  if (!query || typeof query !== "string") {
    json(res, 400, { error: "Missing 'query' string in request body" });
    return;
  }

  // Step 1: Parse (approximate)
  const demo = {
    id: `gen-${Date.now()}`,
    timestamp: new Date().toISOString(),
    source: { type: "user_query", raw: query },
    observedBehavior: { fingerprint: {} },
  };

  const parseResult = await approximate.approximate(schema, demo);
  if (isLeft(parseResult)) {
    json(res, 422, { error: "Parse failed", details: parseResult.left });
    return;
  }

  // Step 2: Compile
  const compileResult = adapter.compile(parseResult.right);
  if (isLeft(compileResult)) {
    json(res, 422, { error: "Compile failed", details: compileResult.left, instance: parseResult.right });
    return;
  }

  json(res, 200, {
    instance: parseResult.right,
    executable: compileResult.right,
  });
}

async function handleEvolve(
  res: http.ServerResponse,
  body: unknown,
  adapter: DomainAdapter,
  approximate: ApproximateAction,
  extend: ExtendAction,
  getMemory: () => Memory,
  setMemory: (memory: Memory) => void,
  convergenceConfig: ConvergenceConfig,
): Promise<void> {
  const { query, observed } = body as { query?: string; observed?: Record<string, unknown> };
  if (!query || typeof query !== "string") {
    json(res, 400, { error: "Missing 'query' string in request body" });
    return;
  }
  if (!observed || typeof observed !== "object") {
    json(res, 400, { error: "Missing 'observed' object in request body (expected behavior fingerprint)" });
    return;
  }

  const memory = getMemory();

  const demonstration = {
    id: `evolve-${Date.now()}`,
    timestamp: new Date().toISOString(),
    source: { type: "user_query", raw: query },
    observedBehavior: { fingerprint: observed },
  };

  const result = await runEvolution({
    memory,
    demonstration,
    adapter,
    approximateAction: approximate,
    extendAction: extend,
    convergenceConfig,
  });

  // If evolved, update memory
  if (result.kind === "evolved") {
    const updatedMemory: Memory = {
      currentSchema: result.newSchema,
      schemaHistory: [...memory.schemaHistory, result.newSchema],
      records: [...memory.records, {
        id: `evo-${Date.now()}`,
        timestamp: new Date().toISOString(),
        demonstrationId: demonstration.id,
        outcome: EvolutionOutcome.Success,
        fromSchemaVersion: memory.currentSchema.version,
        toSchemaVersion: result.newSchema.version,
        iterations: result.iterations,
      }],
    };
    setMemory(updatedMemory);
  }

  json(res, 200, result);
}

async function handleEvolveReport(
  res: http.ServerResponse,
  body: unknown,
  schema: Schema,
  adapter: DomainAdapter,
  approximate: ApproximateAction,
  extend: ExtendAction,
  getMemory: () => Memory,
  setMemory: (memory: Memory) => void,
  convergenceConfig: ConvergenceConfig,
): Promise<void> {
  const { query, observed } = body as { query?: string; observed?: Record<string, unknown> };
  if (!query || typeof query !== "string") {
    json(res, 400, { error: "Missing 'query' string in request body" });
    return;
  }
  if (!observed || typeof observed !== "object") {
    json(res, 400, { error: "Missing 'observed' object in request body (expected behavior fingerprint)" });
    return;
  }

  const memory = getMemory();

  const demonstration = {
    id: `evolve-report-${Date.now()}`,
    timestamp: new Date().toISOString(),
    source: { type: "user_query" as const, raw: query },
    observedBehavior: { fingerprint: observed },
  };

  // Phase A: Approximation
  const approxResult: ApproximationResult = await runApproximation({
    schema: memory.currentSchema,
    demonstration,
    adapter,
    approximateAction: approximate,
  });

  // Phase B: Extension (if insufficient)
  let extResult: ExtensionResult | undefined;
  if (approxResult.kind === "insufficient") {
    extResult = await runExtension({
      schema: memory.currentSchema,
      gap: approxResult.gap,
      demonstration,
      adapter,
      extendAction: extend,
      config: convergenceConfig,
    });
  }

  // Phase C: Codification (if converged)
  let updatedMemory: Memory | undefined;
  if (extResult?.kind === "converged" && approxResult.kind === "insufficient") {
    const codifyResult = runCodification({
      memory,
      candidateSchema: extResult.candidateSchema,
      candidateInstance: extResult.candidateInstance,
      demonstrationId: demonstration.id,
      gap: approxResult.gap,
      iterations: extResult.iterations,
    });

    if (codifyResult._tag === "Right") {
      updatedMemory = codifyResult.right;
      setMemory(updatedMemory);
    }
  }

  // Generate report
  const report = generateCaseReport({
    demonstrationId: demonstration.id,
    schemaBefore: memory.currentSchema,
    approximationResult: approxResult,
    extensionResult: extResult,
    updatedMemory,
  });

  const caseFiles = buildCaseFiles(report);

  json(res, 200, { result: report.outcome, report, caseFiles });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON in request body"));
      }
    });
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}
