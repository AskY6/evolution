/**
 * BiAdapter — BI domain implementation of DomainAdapter.
 *
 * Thin glue that wires schema, instance, compiler, and renderer modules
 * into the evolution framework's DomainAdapter interface.
 */

import type {
  DomainAdapter,
  Either,
  Schema,
  CandidateSchema,
  Extension,
  Instance,
  CandidateInstance,
  Executable,
  CompileResult,
  Behavior,
  RuntimeCapability,
  CompileError,
  ExecuteError,
  ValidationError,
} from "@evolution/core";
import { left, right, Supportability } from "@evolution/core";
import type { BiSchema, BiExtension } from "./core/schema";
import type { DashboardPayload } from "./core/instance";
import { validateBiInstance, validateBiCandidateInstance } from "./core/instance";
import { compileDashboard, inferRequiredFeatures } from "./core/compiler";
import type { DashboardExecutable } from "./core/renderer";
import { BI_RUNTIME, extractFingerprint, lookupFeature } from "./core/renderer";

export class BiAdapter implements DomainAdapter {
  compile(instance: Instance): Either<CompileError, Executable> {
    try {
      const payload = instance.payload as unknown as DashboardPayload;
      const artifact = compileDashboard(payload);
      return right({ format: "echarts-dashboard", artifact });
    } catch (err) {
      return left({
        kind: "compile",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  compileC(candidate: CandidateInstance): CompileResult {
    const merged = {
      ...candidate.basePayload,
      ...candidate.extensionPayload,
    } as unknown as DashboardPayload;

    const requiredFeatures = inferRequiredFeatures(merged);
    const blocked = requiredFeatures.filter(
      (f) => lookupFeature(f) === Supportability.Unfeasible,
    );
    const degraded = requiredFeatures.filter(
      (f) => lookupFeature(f) === Supportability.Feasible,
    );

    if (blocked.length > 0) {
      return {
        kind: "blocked",
        constraints: blocked.map((f) => ({
          feature: f,
          reason: `Feature "${f}" is not supported by the BI runtime`,
        })),
      };
    }

    try {
      const artifact = compileDashboard(merged);
      const executable: Executable = { format: "echarts-dashboard", artifact };

      if (degraded.length > 0) {
        return {
          kind: "degraded",
          executable,
          missing: degraded.map((f) => ({
            feature: f,
            reason: `Feature "${f}" requires engineering effort`,
          })),
        };
      }

      return { kind: "compiled", executable };
    } catch (err) {
      return {
        kind: "blocked",
        constraints: [{
          feature: "compile",
          reason: err instanceof Error ? err.message : String(err),
        }],
      };
    }
  }

  execute(executable: Executable): Either<ExecuteError, Behavior> {
    if (executable.format !== "echarts-dashboard") {
      return left({
        kind: "execute",
        message: `Unsupported executable format: "${executable.format}"`,
      });
    }

    try {
      const dashboard = executable.artifact as DashboardExecutable;
      const fingerprint = extractFingerprint(dashboard);
      return right({ fingerprint: fingerprint as unknown as Record<string, unknown> });
    } catch (err) {
      return left({
        kind: "execute",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  fingerprint(raw: unknown): Behavior {
    const dashboard = raw as DashboardExecutable;
    const fp = extractFingerprint(dashboard);
    return { fingerprint: fp as unknown as Record<string, unknown> };
  }

  runtime(): RuntimeCapability {
    return BI_RUNTIME;
  }

  validate(schema: Schema, instance: Instance): ReadonlyArray<ValidationError> {
    return validateBiInstance(schema as BiSchema, instance);
  }

  validateCandidate(
    candidateSchema: CandidateSchema,
    candidate: CandidateInstance,
  ): ReadonlyArray<ValidationError> {
    const base = candidateSchema.baseSchema as BiSchema;
    const exts = candidateSchema.extensions as ReadonlyArray<BiExtension>;
    return validateBiCandidateInstance(base, exts, candidate);
  }

  materialize(
    base: Schema,
    extensions: ReadonlyArray<Extension>,
    newVersion: string,
  ): Schema {
    const b = base as BiSchema;
    const exts = extensions as ReadonlyArray<BiExtension>;
    return {
      id: b.id,
      version: newVersion,
      fields: [...b.fields, ...exts.flatMap((e) => e.newFields)],
      rules: [...b.rules, ...exts.flatMap((e) => e.newRules)],
    } satisfies BiSchema;
  }
}
