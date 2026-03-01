# @evolution/app

Application layer that assembles `@evolution/core` and `@evolution/bi` into two runnable entry points: an **HTTP server** and a **CLI evolution runner**.

## Prerequisites

Build the monorepo from the root:

```bash
pnpm install
pnpm build
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes (unless `MOCK=1`) | — | OpenRouter API key for LLM calls |
| `OPENROUTER_MODEL` | No | `anthropic/claude-sonnet-4` | Model identifier |
| `PORT` | No | `3000` | Server listen port |
| `MOCK` | No | — | Set to `1` to use a mock LLM (no API key needed) |

## HTTP Server

Starts a server exposing the evolution pipeline as REST endpoints.

```bash
# Real LLM
OPENROUTER_API_KEY=sk-... pnpm start

# Mock LLM (development)
pnpm dev
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/schema` | Current BI schema |
| `POST` | `/parse` | Natural-language query to Instance |
| `POST` | `/compile` | Instance to Executable (ECharts option) |
| `POST` | `/execute` | Executable to Behavior (fingerprint) |
| `POST` | `/generate` | Query to Instance + ECharts option (combined) |
| `POST` | `/evolve` | Run full evolution pipeline |
| `POST` | `/evolve-report` | Run evolution pipeline with case report |

### Examples

```bash
# Generate an ECharts option from a natural-language query
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"query": "Show monthly revenue as a bar chart"}'

# Run evolution with an observed behavior
curl -X POST http://localhost:3000/evolve \
  -H "Content-Type: application/json" \
  -d '{
    "query": "quarterly revenue vs cost comparison bar chart",
    "observed": { "api": {}, "render": {} }
  }'
```

## CLI Evolution Runner

Runs the full evolution pipeline step-by-step (Approximation → Extension → Codification) and writes case report files to `knowledge/cases/`.

```bash
# Mock LLM
MOCK=1 node dist/run-evolution.js \
  --case-id 001 \
  --slug multi-series-comparison \
  --query "quarterly revenue vs cost comparison bar chart" \
  --observed '{"api":{}, "render":{}}'

# Real LLM
OPENROUTER_API_KEY=sk-... node dist/run-evolution.js \
  --case-id 002 \
  --slug filter-support \
  --query "bar chart of revenue filtered by region = APAC" \
  --observed '{"api":{"filters":[{"field":"region","op":"=","value":"APAC"}]}, "render":{}}'
```

### CLI Arguments

| Flag | Default | Description |
|---|---|---|
| `--case-id` | `001` | Case identifier |
| `--slug` | `unnamed` | Human-readable case name |
| `--query` | (required) | Natural-language query describing desired chart |
| `--observed` | `{}` | JSON object of observed behavior fingerprint |

Output is written to `knowledge/cases/{caseId}-{slug}/`.
