/**
 * Reporter — generate structured case reports for evolution events.
 *
 * Produces CaseReport objects from pipeline results and optionally
 * writes them to disk as knowledge/cases/NNN-slug/ directories.
 */

import type { Schema } from "./types/schema.js";
import type { Gap } from "./types/gap.js";
import type { Memory } from "./types/memory.js";
import type { ApproximationResult } from "./pipelines/approximation.js";
import type { ExtensionResult } from "./pipelines/extension.js";

// ---------------------------------------------------------------------------
// CaseReport type
// ---------------------------------------------------------------------------

/** Structured case report for an evolution event. */
export interface CaseReport {
  readonly id: string;
  readonly timestamp: string;
  readonly demonstrationId: string;
  readonly outcome: "assimilated" | "evolved" | "escalated" | "failed";
  readonly schemaBefore: Schema;
  readonly schemaAfter?: Schema;
  readonly gap?: Gap;
  readonly extensionIterations?: number;
  readonly summary: string;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generate a CaseReport from pipeline results.
 */
export function generateCaseReport(input: {
  demonstrationId: string;
  schemaBefore: Schema;
  approximationResult: ApproximationResult;
  extensionResult?: ExtensionResult;
  updatedMemory?: Memory;
}): CaseReport {
  const { demonstrationId, schemaBefore, approximationResult, extensionResult, updatedMemory } = input;
  const timestamp = new Date().toISOString();
  const id = `case-${Date.now()}`;

  // Assimilated: approximation found schema sufficient
  if (approximationResult.kind === "sufficient") {
    return {
      id,
      timestamp,
      demonstrationId,
      outcome: "assimilated",
      schemaBefore,
      summary: "Current schema is sufficient — no extension needed.",
    };
  }

  // Failed at approximation stage
  if (approximationResult.kind === "failed") {
    return {
      id,
      timestamp,
      demonstrationId,
      outcome: "failed",
      schemaBefore,
      summary: `Pipeline failed at ${approximationResult.stage}: ${approximationResult.message}`,
    };
  }

  // Approximation was insufficient — check extension result
  const gap = approximationResult.gap;

  if (!extensionResult) {
    return {
      id,
      timestamp,
      demonstrationId,
      outcome: "failed",
      schemaBefore,
      gap,
      summary: "Approximation found gap but extension was not attempted.",
    };
  }

  if (extensionResult.kind === "failed") {
    return {
      id,
      timestamp,
      demonstrationId,
      outcome: "failed",
      schemaBefore,
      gap,
      summary: `Extension failed at ${extensionResult.stage}: ${extensionResult.message}`,
    };
  }

  if (extensionResult.kind === "diverged") {
    return {
      id,
      timestamp,
      demonstrationId,
      outcome: "escalated",
      schemaBefore,
      gap,
      extensionIterations: extensionResult.iterations,
      summary: `Extension diverged after ${extensionResult.iterations} iterations — escalated for human review.`,
    };
  }

  // Converged — check if codification succeeded
  if (updatedMemory) {
    return {
      id,
      timestamp,
      demonstrationId,
      outcome: "evolved",
      schemaBefore,
      schemaAfter: updatedMemory.currentSchema,
      gap,
      extensionIterations: extensionResult.iterations,
      summary: `Schema evolved from ${schemaBefore.version} to ${updatedMemory.currentSchema.version} after ${extensionResult.iterations} iteration(s).`,
    };
  }

  return {
    id,
    timestamp,
    demonstrationId,
    outcome: "failed",
    schemaBefore,
    gap,
    extensionIterations: extensionResult.iterations,
    summary: "Extension converged but codification was not completed.",
  };
}

// ---------------------------------------------------------------------------
// Report serialization
// ---------------------------------------------------------------------------

/**
 * Format a CaseReport as a human-readable markdown string.
 */
export function formatCaseReport(report: CaseReport): string {
  const lines: string[] = [
    `# Case Report: ${report.id}`,
    "",
    `- **Timestamp:** ${report.timestamp}`,
    `- **Demonstration:** ${report.demonstrationId}`,
    `- **Outcome:** ${report.outcome}`,
  ];

  if (report.extensionIterations !== undefined) {
    lines.push(`- **Extension iterations:** ${report.extensionIterations}`);
  }

  lines.push("", `## Summary`, "", report.summary);

  if (report.gap) {
    lines.push(
      "",
      `## Gap`,
      "",
      `- **Severity:** ${report.gap.severity}`,
      `- **Source:** ${report.gap.source}`,
      `- **Summary:** ${report.gap.summary}`,
      `- **Discrepancies:** ${report.gap.discrepancies.length}`,
    );
    for (const d of report.gap.discrepancies) {
      lines.push(`  - \`${d.path}\`: ${d.type} (expected: ${JSON.stringify(d.expected)}, actual: ${JSON.stringify(d.actual)})`);
    }
  }

  if (report.schemaAfter) {
    lines.push(
      "",
      `## Schema Change`,
      "",
      `- **Before:** ${report.schemaBefore.version} (${report.schemaBefore.fields.length} fields)`,
      `- **After:** ${report.schemaAfter.version} (${report.schemaAfter.fields.length} fields)`,
    );
  }

  return lines.join("\n");
}

/**
 * Build the file contents for a case directory.
 *
 * Returns a map of filename → content that can be written to
 * knowledge/cases/NNN-slug/.
 */
export function buildCaseFiles(report: CaseReport): Record<string, string> {
  const files: Record<string, string> = {};

  files["report.md"] = formatCaseReport(report);
  files["schema-before.json"] = JSON.stringify(report.schemaBefore, null, 2);

  if (report.schemaAfter) {
    files["schema-after.json"] = JSON.stringify(report.schemaAfter, null, 2);
  }

  if (report.gap) {
    files["gap.json"] = JSON.stringify(report.gap, null, 2);
  }

  return files;
}
