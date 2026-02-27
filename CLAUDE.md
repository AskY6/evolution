# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DSL Evolution Engine — a system that automatically expands a DSL's knowledge framework (Schema) by observing expert behavior. Inspired by Piaget's cognitive development theory: Assimilation (use existing framework) and Accommodation (extend framework).

**Status:** Pre-implementation. Design documents exist in `knowledge/decisions/` and `roadmap.md`. No source code yet.

## Planned Tech Stack & Structure

Turborepo + TypeScript monorepo with strict separation:

- `packages/evolution/` — Domain-agnostic framework (how learning happens)
- `packages/bi/` — BI domain use case (what to learn), depends only on exported types/interfaces from evolution
- `apps/evolution/` — Application layer assembling both packages
- `knowledge/` — Design decisions, evolution cases, schemas

**Dependency rule:** `packages/bi` → `packages/evolution` only via the `DomainAdapter` interface. No leakage of domain-specific logic into the framework.

## Architecture

### Two-Phase Pipeline

**Phase A — Approximation (deterministic):**
`Approximate → Validate → Compile → Execute → Compare`
All Current types. Produces `Sufficient` or `Insufficient(Gap)`.

**Phase B — Extension (non-deterministic, AI-driven):**
`Extend → ValidateC → CompileC → Execute → Compare` (iterates until convergence)
Produces Candidate types. Non-convergence escalates to human review.

### Current vs Candidate Type Distinction

Every entity has a Current (trusted, stable) and Candidate (provisional) variant:
- **Schema / CandidateSchema** — CandidateSchema extends a `baseSchema` with `extensions`, always rollback-able
- **Instance / CandidateInstance** — CandidateInstance splits into `basePayload` + `extensionPayload`
- **Compile signatures differ:** Instance → `Either<Error, Executable>` (deterministic); CandidateInstance → `CompileResult` (Compiled|Blocked|Degraded)

### DomainAdapter Interface

```typescript
interface DomainAdapter {
  compile:     (instance: Instance) => Either<CompileError, Executable>
  compileC:    (candidate: CandidateInstance) => CompileResult
  execute:     (executable: Executable) => Either<ExecuteError, Behavior>
  fingerprint: (raw: unknown) => Behavior
  runtime:     () => RuntimeCapability
}
```

### Deterministic / Non-deterministic Isolation

Users always run on the deterministic pipeline (Compile/Execute/Compare). AI-driven operations (Approximate, Extend) run in background; their outputs enter the user world only after Promote (codification).

## Key Design Documents

- `knowledge/decisions/000-design-philosophy.md` — Core theory, type system, atomic actions, pipeline architecture
- `roadmap.md` — 24-week phased roadmap with file-path-to-phase mapping

## Language

Design documents are written in Chinese. Code and type definitions use English identifiers.
