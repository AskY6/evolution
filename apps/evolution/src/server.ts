/**
 * Minimal API server — parse → compile → execute endpoints.
 *
 * Uses Node built-in http module (no external dependencies).
 *
 * Endpoints:
 *   POST /parse    — { query: string } → Instance
 *   POST /compile  — Instance → Executable (ECharts option)
 *   POST /execute  — Executable → Behavior
 *   POST /generate — { query: string } → ECharts option (combined pipeline)
 *   GET  /health   — health check
 *   GET  /schema   — current schema
 */

import * as http from "node:http";
import type { Schema, Instance, Executable, ApproximateAction, DomainAdapter } from "@evolution/core";
import { isLeft } from "@evolution/core";

export interface ServerDeps {
  readonly schema: Schema;
  readonly adapter: DomainAdapter;
  readonly approximate: ApproximateAction;
}

export function createServer(deps: ServerDeps): http.Server {
  const { schema, adapter, approximate } = deps;

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
        json(res, 200, schema);
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
