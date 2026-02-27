/**
 * Comparator — Behavior × Behavior → Gap.
 *
 * Deep structural diff of two behavioral fingerprints. Domain-agnostic:
 * it doesn't know what the fingerprint keys mean, only that they form
 * a nested record structure that can be compared structurally.
 *
 * The Compare action in the pipeline uses this to determine whether the
 * system's output matches the expert's demonstrated behavior.
 */

import type { Behavior } from "./types/demonstration.js";
import type { Gap, Discrepancy } from "./types/gap.js";
import { Severity, DiscrepancyType, GapSource } from "./types/gap.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two Behaviors and produce a Gap describing their differences.
 *
 * @param expected - The expert's demonstrated behavior (ground truth).
 * @param actual   - The system's produced behavior (to be checked).
 * @returns A Gap. If behaviors are identical, discrepancies will be empty
 *          and severity will be Minor.
 */
export function compare(expected: Behavior, actual: Behavior): Gap {
  const discrepancies = diffValues(
    expected.fingerprint,
    actual.fingerprint,
    "",
  );
  const severity = calculateSeverity(discrepancies);
  const summary = summarize(discrepancies);

  return {
    source: GapSource.Behavioral,
    discrepancies,
    severity,
    summary,
  };
}

/**
 * Check whether two Behaviors are equivalent (no discrepancies).
 */
export function isEquivalent(expected: Behavior, actual: Behavior): boolean {
  return diffValues(expected.fingerprint, actual.fingerprint, "").length === 0;
}

// ---------------------------------------------------------------------------
// Deep structural diff
// ---------------------------------------------------------------------------

function diffValues(
  expected: unknown,
  actual: unknown,
  path: string,
): Discrepancy[] {
  // Same reference or both primitives with equal value
  if (expected === actual) {
    return [];
  }

  // Handle nulls/undefined
  if (expected === null || expected === undefined) {
    if (actual === null || actual === undefined) {
      return [];
    }
    return [discrepancy(path, DiscrepancyType.Extra, expected, actual)];
  }
  if (actual === null || actual === undefined) {
    return [discrepancy(path, DiscrepancyType.Missing, expected, actual)];
  }

  // Type mismatch (array vs object vs primitive)
  const expectedKind = structuralKind(expected);
  const actualKind = structuralKind(actual);
  if (expectedKind !== actualKind) {
    return [discrepancy(path, DiscrepancyType.TypeMismatch, expected, actual)];
  }

  // Both arrays
  if (Array.isArray(expected) && Array.isArray(actual)) {
    return diffArrays(expected, actual, path);
  }

  // Both plain objects
  if (expectedKind === "object") {
    return diffObjects(
      expected as Record<string, unknown>,
      actual as Record<string, unknown>,
      path,
    );
  }

  // Primitives that aren't equal (we already checked === above)
  return [discrepancy(path, DiscrepancyType.ValueMismatch, expected, actual)];
}

function diffObjects(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  path: string,
): Discrepancy[] {
  const results: Discrepancy[] = [];
  const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);

  for (const key of allKeys) {
    const childPath = path ? `${path}.${key}` : key;
    const inExpected = key in expected;
    const inActual = key in actual;

    if (inExpected && !inActual) {
      results.push(discrepancy(childPath, DiscrepancyType.Missing, expected[key], undefined));
    } else if (!inExpected && inActual) {
      results.push(discrepancy(childPath, DiscrepancyType.Extra, undefined, actual[key]));
    } else {
      results.push(...diffValues(expected[key], actual[key], childPath));
    }
  }

  return results;
}

function diffArrays(
  expected: unknown[],
  actual: unknown[],
  path: string,
): Discrepancy[] {
  const results: Discrepancy[] = [];
  const maxLen = Math.max(expected.length, actual.length);

  for (let i = 0; i < maxLen; i++) {
    const childPath = `${path}[${i}]`;
    if (i >= expected.length) {
      results.push(discrepancy(childPath, DiscrepancyType.Extra, undefined, actual[i]));
    } else if (i >= actual.length) {
      results.push(discrepancy(childPath, DiscrepancyType.Missing, expected[i], undefined));
    } else {
      results.push(...diffValues(expected[i], actual[i], childPath));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Severity calculation
// ---------------------------------------------------------------------------

/**
 * Calculate severity from discrepancies.
 *
 * - 0 discrepancies → Minor (no real gap)
 * - 1-2 value mismatches → Moderate
 * - Any type mismatch or missing key → Major
 * - 5+ discrepancies or structural divergence → Critical
 */
function calculateSeverity(discrepancies: ReadonlyArray<Discrepancy>): Severity {
  if (discrepancies.length === 0) return Severity.Minor;
  if (discrepancies.length >= 5) return Severity.Critical;

  const hasTypeMismatch = discrepancies.some((d) => d.type === DiscrepancyType.TypeMismatch);
  const hasMissing = discrepancies.some((d) => d.type === DiscrepancyType.Missing);

  if (hasTypeMismatch) return Severity.Critical;
  if (hasMissing && discrepancies.length >= 3) return Severity.Major;
  if (hasMissing) return Severity.Major;

  return Severity.Moderate;
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

function summarize(discrepancies: ReadonlyArray<Discrepancy>): string {
  if (discrepancies.length === 0) {
    return "Behaviors are equivalent.";
  }

  const counts = { missing: 0, extra: 0, value_mismatch: 0, type_mismatch: 0 };
  for (const d of discrepancies) {
    counts[d.type]++;
  }

  const parts: string[] = [];
  if (counts.missing > 0) parts.push(`${counts.missing} missing`);
  if (counts.extra > 0) parts.push(`${counts.extra} extra`);
  if (counts.value_mismatch > 0) parts.push(`${counts.value_mismatch} value mismatch`);
  if (counts.type_mismatch > 0) parts.push(`${counts.type_mismatch} type mismatch`);

  return `${discrepancies.length} discrepancies: ${parts.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function discrepancy(
  path: string,
  type: DiscrepancyType,
  expected: unknown,
  actual: unknown,
): Discrepancy {
  return { path: path || "(root)", type, expected, actual };
}

function structuralKind(value: unknown): "array" | "object" | "primitive" {
  if (Array.isArray(value)) return "array";
  if (typeof value === "object" && value !== null) return "object";
  return "primitive";
}
