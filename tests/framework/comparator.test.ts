import { describe, it, expect } from "vitest";
import { compare, isEquivalent } from "../../packages/evolution/src/comparator.js";
import { Severity, DiscrepancyType } from "../../packages/evolution/src/types/gap.js";
import type { Behavior } from "../../packages/evolution/src/types/demonstration.js";

function behavior(fingerprint: Record<string, unknown>): Behavior {
  return { fingerprint };
}

// ---------------------------------------------------------------------------
// Identical behaviors
// ---------------------------------------------------------------------------

describe("comparator — identical behaviors", () => {
  it("produces no discrepancies for identical flat objects", () => {
    const a = behavior({ type: "bar", count: 3 });
    const b = behavior({ type: "bar", count: 3 });
    const gap = compare(a, b);
    expect(gap.discrepancies).toEqual([]);
    expect(gap.severity).toBe(Severity.Minor);
    expect(isEquivalent(a, b)).toBe(true);
  });

  it("produces no discrepancies for identical nested objects", () => {
    const a = behavior({ render: { type: "line", series: [{ name: "s1" }] } });
    const b = behavior({ render: { type: "line", series: [{ name: "s1" }] } });
    expect(compare(a, b).discrepancies).toEqual([]);
  });

  it("produces no discrepancies for empty fingerprints", () => {
    expect(compare(behavior({}), behavior({})).discrepancies).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Missing keys
// ---------------------------------------------------------------------------

describe("comparator — missing keys", () => {
  it("detects a key present in expected but missing in actual", () => {
    const gap = compare(
      behavior({ type: "bar", color: "red" }),
      behavior({ type: "bar" }),
    );
    expect(gap.discrepancies.length).toBe(1);
    expect(gap.discrepancies[0].path).toBe("color");
    expect(gap.discrepancies[0].type).toBe(DiscrepancyType.Missing);
    expect(gap.discrepancies[0].expected).toBe("red");
    expect(gap.discrepancies[0].actual).toBeUndefined();
  });

  it("detects a key present in actual but missing in expected", () => {
    const gap = compare(
      behavior({ type: "bar" }),
      behavior({ type: "bar", extra: true }),
    );
    expect(gap.discrepancies.length).toBe(1);
    expect(gap.discrepancies[0].type).toBe(DiscrepancyType.Extra);
  });
});

// ---------------------------------------------------------------------------
// Value mismatches
// ---------------------------------------------------------------------------

describe("comparator — value mismatches", () => {
  it("detects differing primitive values", () => {
    const gap = compare(
      behavior({ count: 10 }),
      behavior({ count: 20 }),
    );
    expect(gap.discrepancies.length).toBe(1);
    expect(gap.discrepancies[0].type).toBe(DiscrepancyType.ValueMismatch);
    expect(gap.discrepancies[0].expected).toBe(10);
    expect(gap.discrepancies[0].actual).toBe(20);
  });

  it("detects string value differences", () => {
    const gap = compare(
      behavior({ name: "alpha" }),
      behavior({ name: "beta" }),
    );
    expect(gap.discrepancies[0].type).toBe(DiscrepancyType.ValueMismatch);
  });
});

// ---------------------------------------------------------------------------
// Type mismatches
// ---------------------------------------------------------------------------

describe("comparator — type mismatches", () => {
  it("detects object vs array mismatch", () => {
    const gap = compare(
      behavior({ data: { x: 1 } }),
      behavior({ data: [1, 2] }),
    );
    expect(gap.discrepancies.length).toBe(1);
    expect(gap.discrepancies[0].type).toBe(DiscrepancyType.TypeMismatch);
  });

  it("detects primitive vs object mismatch", () => {
    const gap = compare(
      behavior({ value: "text" }),
      behavior({ value: { nested: true } }),
    );
    expect(gap.discrepancies[0].type).toBe(DiscrepancyType.TypeMismatch);
  });
});

// ---------------------------------------------------------------------------
// Nested / deep diffs
// ---------------------------------------------------------------------------

describe("comparator — nested structures", () => {
  it("reports correct dot-notation paths for nested discrepancies", () => {
    const gap = compare(
      behavior({ render: { axis: { label: "X" } } }),
      behavior({ render: { axis: { label: "Y" } } }),
    );
    expect(gap.discrepancies.length).toBe(1);
    expect(gap.discrepancies[0].path).toBe("render.axis.label");
  });

  it("reports correct array-notation paths", () => {
    const gap = compare(
      behavior({ items: ["a", "b", "c"] }),
      behavior({ items: ["a", "x", "c"] }),
    );
    expect(gap.discrepancies.length).toBe(1);
    expect(gap.discrepancies[0].path).toBe("items[1]");
  });

  it("detects array length differences", () => {
    const gap = compare(
      behavior({ items: [1, 2, 3] }),
      behavior({ items: [1, 2] }),
    );
    expect(gap.discrepancies.length).toBe(1);
    expect(gap.discrepancies[0].path).toBe("items[2]");
    expect(gap.discrepancies[0].type).toBe(DiscrepancyType.Missing);
  });
});

// ---------------------------------------------------------------------------
// Severity calculation
// ---------------------------------------------------------------------------

describe("comparator — severity", () => {
  it("assigns Minor to identical behaviors", () => {
    const gap = compare(behavior({ x: 1 }), behavior({ x: 1 }));
    expect(gap.severity).toBe(Severity.Minor);
  });

  it("assigns Moderate to small value mismatches", () => {
    const gap = compare(behavior({ x: 1 }), behavior({ x: 2 }));
    expect(gap.severity).toBe(Severity.Moderate);
  });

  it("assigns Major when keys are missing", () => {
    const gap = compare(behavior({ x: 1, y: 2 }), behavior({ x: 1 }));
    expect(gap.severity).toBe(Severity.Major);
  });

  it("assigns Critical for type mismatches", () => {
    const gap = compare(behavior({ x: "text" }), behavior({ x: [1, 2] }));
    expect(gap.severity).toBe(Severity.Critical);
  });

  it("assigns Critical for 5+ discrepancies", () => {
    const gap = compare(
      behavior({ a: 1, b: 2, c: 3, d: 4, e: 5 }),
      behavior({ a: 9, b: 9, c: 9, d: 9, e: 9 }),
    );
    expect(gap.severity).toBe(Severity.Critical);
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe("comparator — summary", () => {
  it("reports 'equivalent' for no discrepancies", () => {
    const gap = compare(behavior({ x: 1 }), behavior({ x: 1 }));
    expect(gap.summary).toContain("equivalent");
  });

  it("includes counts in summary", () => {
    const gap = compare(
      behavior({ a: 1, b: 2 }),
      behavior({ a: 9, c: 3 }),
    );
    expect(gap.summary).toMatch(/\d+ discrepancies/);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("comparator — edge cases", () => {
  it("handles null values", () => {
    const gap = compare(
      behavior({ x: null } as unknown as Record<string, unknown>),
      behavior({ x: null } as unknown as Record<string, unknown>),
    );
    expect(gap.discrepancies).toEqual([]);
  });

  it("handles deeply nested arrays of objects", () => {
    const gap = compare(
      behavior({ data: [{ items: [{ id: 1 }] }] }),
      behavior({ data: [{ items: [{ id: 2 }] }] }),
    );
    expect(gap.discrepancies.length).toBe(1);
    expect(gap.discrepancies[0].path).toBe("data[0].items[0].id");
  });
});
