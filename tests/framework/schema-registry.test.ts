import { describe, it, expect } from "vitest";
import { SchemaRegistry, materialize } from "../../packages/evolution/src/schema-registry.js";
import type { Schema, CandidateSchema } from "../../packages/evolution/src/types/schema.js";

// ---------------------------------------------------------------------------
// Test fixtures — domain-agnostic schemas (no BI concepts)
// ---------------------------------------------------------------------------

const schemaV1: Schema = {
  id: "task",
  version: "1.0.0",
  fields: [
    { name: "title", description: "Task title", type: { kind: "string" }, required: true },
    { name: "priority", description: "Priority", type: { kind: "string", enum: ["low", "medium", "high"] }, required: true },
  ],
  rules: [],
};

const schemaV2: Schema = {
  id: "task",
  version: "2.0.0",
  fields: [
    ...schemaV1.fields,
    { name: "assignee", description: "Assigned person", type: { kind: "string" }, required: false },
  ],
  rules: [],
};

// ---------------------------------------------------------------------------
// load / get / current
// ---------------------------------------------------------------------------

describe("SchemaRegistry — load, get, current", () => {
  it("loads a schema and retrieves it by id+version", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);
    expect(reg.get("task", "1.0.0")).toEqual(schemaV1);
  });

  it("first loaded schema becomes current", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);
    expect(reg.current()).toEqual(schemaV1);
  });

  it("loading a second schema does not change current", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);
    reg.load(schemaV2);
    expect(reg.current()).toEqual(schemaV1);
  });

  it("returns undefined for unknown id+version", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);
    expect(reg.get("task", "99.0.0")).toBeUndefined();
    expect(reg.get("unknown", "1.0.0")).toBeUndefined();
  });

  it("throws on current() when empty", () => {
    const reg = new SchemaRegistry();
    expect(() => reg.current()).toThrow("empty");
  });

  it("isEmpty returns true for empty registry", () => {
    const reg = new SchemaRegistry();
    expect(reg.isEmpty()).toBe(true);
    reg.load(schemaV1);
    expect(reg.isEmpty()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// promote
// ---------------------------------------------------------------------------

describe("SchemaRegistry — promote", () => {
  it("promotes a CandidateSchema to a new version", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);

    const candidate: CandidateSchema = {
      baseSchema: schemaV1,
      extensions: [
        {
          id: "ext-assignee",
          description: "Add assignee",
          newFields: [
            { name: "assignee", description: "Assigned person", type: { kind: "string" }, required: false },
          ],
          newRules: [],
        },
      ],
    };

    const promoted = reg.promote(candidate, "1.1.0");

    expect(promoted.id).toBe("task");
    expect(promoted.version).toBe("1.1.0");
    expect(promoted.fields.length).toBe(3);
    expect(promoted.fields[2].name).toBe("assignee");
  });

  it("promoted schema becomes the new current", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);

    const candidate: CandidateSchema = {
      baseSchema: schemaV1,
      extensions: [{
        id: "ext-1",
        description: "Ext",
        newFields: [{ name: "extra", description: "x", type: { kind: "boolean" }, required: false }],
        newRules: [],
      }],
    };

    const promoted = reg.promote(candidate, "1.1.0");
    expect(reg.current()).toEqual(promoted);
  });

  it("merges rules from multiple extensions", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);

    const candidate: CandidateSchema = {
      baseSchema: schemaV1,
      extensions: [
        {
          id: "ext-a",
          description: "A",
          newFields: [{ name: "a", description: "a", type: { kind: "string" }, required: false }],
          newRules: [{ kind: "depends_on", field: "a", requires: "title" }],
        },
        {
          id: "ext-b",
          description: "B",
          newFields: [{ name: "b", description: "b", type: { kind: "number" }, required: false }],
          newRules: [],
        },
      ],
    };

    const promoted = reg.promote(candidate, "1.2.0");
    expect(promoted.fields.length).toBe(4); // 2 base + 2 ext
    expect(promoted.rules.length).toBe(1); // 1 from ext-a
  });
});

// ---------------------------------------------------------------------------
// rollback
// ---------------------------------------------------------------------------

describe("SchemaRegistry — rollback", () => {
  it("rolls back to a previously loaded version", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);
    reg.load(schemaV2);

    // Manually set current to v2 via promote or load
    const candidate: CandidateSchema = {
      baseSchema: schemaV1,
      extensions: [{
        id: "ext",
        description: "x",
        newFields: [{ name: "x", description: "x", type: { kind: "boolean" }, required: false }],
        newRules: [],
      }],
    };
    reg.promote(candidate, "1.1.0");
    expect(reg.current().version).toBe("1.1.0");

    // Rollback to v1
    const rolledBack = reg.rollback("task", "1.0.0");
    expect(rolledBack).toEqual(schemaV1);
    expect(reg.current()).toEqual(schemaV1);
  });

  it("throws when rolling back to non-existent version", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);
    expect(() => reg.rollback("task", "99.0.0")).toThrow("not found");
  });
});

// ---------------------------------------------------------------------------
// history
// ---------------------------------------------------------------------------

describe("SchemaRegistry — history", () => {
  it("returns all loaded schemas in insertion order", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);
    reg.load(schemaV2);
    const hist = reg.history();
    expect(hist.length).toBe(2);
    expect(hist[0]).toEqual(schemaV1);
    expect(hist[1]).toEqual(schemaV2);
  });

  it("includes promoted schemas in history", () => {
    const reg = new SchemaRegistry();
    reg.load(schemaV1);

    const candidate: CandidateSchema = {
      baseSchema: schemaV1,
      extensions: [{
        id: "ext",
        description: "x",
        newFields: [],
        newRules: [],
      }],
    };
    reg.promote(candidate, "1.1.0");

    const hist = reg.history();
    expect(hist.length).toBe(2);
    expect(hist[1].version).toBe("1.1.0");
  });
});

// ---------------------------------------------------------------------------
// materialize (standalone function)
// ---------------------------------------------------------------------------

describe("materialize", () => {
  it("produces a flat schema from base + extensions", () => {
    const result = materialize(schemaV1, [
      {
        id: "ext-1",
        description: "Add done flag",
        newFields: [{ name: "done", description: "Done", type: { kind: "boolean" }, required: false }],
        newRules: [{ kind: "depends_on", field: "done", requires: "title" }],
      },
    ], "1.1.0");

    expect(result.id).toBe("task");
    expect(result.version).toBe("1.1.0");
    expect(result.fields.length).toBe(3);
    expect(result.rules.length).toBe(1);
  });

  it("preserves base fields and rules when extensions are empty", () => {
    const base: Schema = { ...schemaV1, rules: [{ kind: "depends_on", field: "priority", requires: "title" }] };
    const result = materialize(base, [], "1.0.1");
    expect(result.fields).toEqual(base.fields);
    expect(result.rules).toEqual(base.rules);
  });
});
