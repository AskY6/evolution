# @evolution/core

Domain-agnostic evolution framework — defines **how learning happens** without knowing what is being learned. Any domain (BI, forms, workflows, etc.) plugs in by implementing the `DomainAdapter` interface.

## Concepts

The framework is built on the **Current / Candidate** distinction:

- **Schema** — trusted, stable knowledge framework. Defines fields (vocabulary) and rules (grammar).
- **CandidateSchema** — provisional schema = base Schema + Extensions. Always rollback-able.
- **Instance** — concrete expression of a Schema, fully expressible in the current vocabulary.
- **CandidateInstance** — splits into `basePayload` (current Schema) + `extensionPayload` (needs extension).
- **Gap** — structural diff between expected and actual Behavior, with severity (Minor → Critical).
- **Memory** — accumulated knowledge state: current Schema, history, evolution records.

## Three-Phase Pipeline

```
Phase A: Approximation (deterministic path)
  Approximate → Validate → Compile → Execute → Compare
  Result: Sufficient | Insufficient(Gap) | Failed

Phase B: Extension (iterative convergence loop)
  Extend → ValidateC → CompileC → Execute → Compare → [loop if not converged]
  Result: Converged | Diverged | Failed

Phase C: Codification
  Promote CandidateSchema into Memory → new Schema version
```

Full orchestration via `runEvolution()` composes all three:

```
Sufficient     → Assimilated  (no change needed)
Converged      → Evolved      (schema extended and promoted)
Diverged       → Escalated    (needs human review)
Any failure    → PipelineFailed
```

## Integration Point: DomainAdapter

The **only** interface a domain package needs to implement:

```typescript
import type { DomainAdapter } from "@evolution/core";

interface DomainAdapter {
  // Current world (deterministic)
  compile(instance: Instance): Either<CompileError, Executable>;
  execute(executable: Executable): Either<ExecuteError, Behavior>;

  // Candidate world (three-way result)
  compileC(candidate: CandidateInstance): CompileResult; // Compiled | Blocked | Degraded

  // Bridging
  fingerprint(raw: unknown): Behavior;
  runtime(): RuntimeCapability;
}
```

## AI-Driven Actions

Two non-deterministic actions must be provided by the domain (typically LLM-powered):

```typescript
import type { ApproximateAction, ExtendAction } from "@evolution/core";

// Schema + Demonstration → Instance
interface ApproximateAction {
  approximate(schema: Schema, demonstration: Demonstration): Promise<Either<ApproximateError, Instance>>;
}

// Schema + Gap + Demonstration → Extension + CandidateInstance
interface ExtendAction {
  extend(
    schema: Schema,
    gap: Gap,
    demonstration: Demonstration,
    existingExtensions: ReadonlyArray<Extension>,
  ): Promise<Either<ExtendError, ExtendResult>>;
}
```

## Usage

### Run the full evolution pipeline

```typescript
import { runEvolution, SchemaRegistry } from "@evolution/core";
import type { Memory, ConvergenceConfig } from "@evolution/core";

const result = await runEvolution({
  memory,
  demonstration,
  adapter,             // DomainAdapter implementation
  approximateAction,   // ApproximateAction implementation
  extendAction,        // ExtendAction implementation
  convergenceConfig: { maxIterations: 5, gapThreshold: 2 },
});

switch (result.kind) {
  case "assimilated": // Current schema is sufficient
  case "evolved":     // Schema was extended: result.newSchema
  case "escalated":   // Diverged, needs human review
  case "failed":      // Pipeline error at result.stage
}
```

### Run sub-pipelines individually

Useful when you need intermediate results (e.g., for case reporting):

```typescript
import {
  runApproximation,
  runExtension,
  runCodification,
} from "@evolution/core";

// Phase A
const approx = await runApproximation({ schema, demonstration, adapter, approximateAction });

// Phase B (if insufficient)
if (approx.kind === "insufficient") {
  const ext = await runExtension({
    schema, gap: approx.gap, demonstration, adapter, extendAction,
    config: { maxIterations: 5, gapThreshold: 2 },
  });

  // Phase C (if converged)
  if (ext.kind === "converged") {
    const codified = runCodification({
      memory, candidateSchema: ext.candidateSchema,
      candidateInstance: ext.candidateInstance,
      demonstrationId: "...", gap: approx.gap, iterations: ext.iterations,
    });
  }
}
```

### Schema management

```typescript
import { SchemaRegistry, materialize } from "@evolution/core";

const registry = new SchemaRegistry();
registry.load(mySchema);              // Register a schema
registry.current();                   // Get active schema
registry.promote(candidateSchema, "0.2.0"); // Promote candidate → new version
registry.rollback("bi", "0.1.0");     // Restore a previous version
registry.history();                   // All versions in order
```

### Validation

```typescript
import { validateInstance, validateCandidateInstance } from "@evolution/core";

// Current world: Schema + Instance → ValidationError[]
const errors = validateInstance(schema, instance);

// Candidate world: CandidateSchema + CandidateInstance → ValidationError[]
const candidateErrors = validateCandidateInstance(candidateSchema, candidateInstance);
```

### Comparison

```typescript
import { compare, isEquivalent } from "@evolution/core";

const gap = compare(expectedBehavior, actualBehavior);
// gap.severity: Minor | Moderate | Major | Critical
// gap.discrepancies: Array<{ path, type, expected, actual }>

const same = isEquivalent(expected, actual); // boolean
```

### Case reporting

```typescript
import { generateCaseReport, formatCaseReport, buildCaseFiles } from "@evolution/core";

const report = generateCaseReport({
  demonstrationId: "demo-001",
  schemaBefore: schema,
  approximationResult: approx,
  extensionResult: ext,
  updatedMemory: memory,
});

const markdown = formatCaseReport(report);
const files = buildCaseFiles(report); // { "report.md", "schema-before.json", ... }
```

## Type System

Key types re-exported from the package:

| Category | Types |
|---|---|
| Schema | `Schema`, `CandidateSchema`, `Extension`, `FieldDefinition`, `FieldType`, `Rule` |
| Instance | `Instance`, `CandidateInstance`, `Payload` |
| Pipeline | `EvolutionResult` (`Evolved` \| `Assimilated` \| `Escalated` \| `PipelineFailed`), `ConvergenceConfig` |
| Gap | `Gap`, `Discrepancy`, `Severity`, `DiscrepancyType` |
| Compile | `Executable`, `CompileResult` (`CompiledResult` \| `BlockedResult` \| `DegradedResult`) |
| Memory | `Memory`, `EvolutionRecord`, `EvolutionOutcome` |
| Errors | `ValidationError`, `CompileError`, `ExecuteError`, `ApproximateError`, `ExtendError`, `PromoteError` |
| Utility | `Either<E, A>`, `left()`, `right()`, `isLeft()`, `isRight()` |
