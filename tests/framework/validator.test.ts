import { describe, it, expect } from "vitest";
import { validateInstance, validateCandidateInstance } from "../../packages/evolution/src/validator.js";
import type { Schema, CandidateSchema } from "../../packages/evolution/src/types/schema.js";
import type { Instance, CandidateInstance } from "../../packages/evolution/src/types/instance.js";

// ---------------------------------------------------------------------------
// Test fixtures — domain-agnostic "task" schema (no BI concepts)
// ---------------------------------------------------------------------------

const taskSchema: Schema = {
  id: "task",
  version: "1.0.0",
  fields: [
    { name: "title", description: "Task title", type: { kind: "string" }, required: true },
    { name: "priority", description: "Priority level", type: { kind: "string", enum: ["low", "medium", "high"] }, required: true },
    { name: "count", description: "Item count", type: { kind: "number", min: 0, max: 100, integer: true }, required: false },
    { name: "done", description: "Completion flag", type: { kind: "boolean" }, required: false },
    {
      name: "tags",
      description: "Tags list",
      type: { kind: "array", element: { kind: "string" }, minItems: 0, maxItems: 5 },
      required: false,
    },
    {
      name: "metadata",
      description: "Nested metadata",
      type: {
        kind: "object",
        fields: [
          { name: "createdBy", description: "Author", type: { kind: "string" }, required: true },
          { name: "version", description: "Version number", type: { kind: "number" }, required: false },
        ],
      },
      required: false,
    },
  ],
  rules: [
    { kind: "required_if", field: "count", when: { field: "priority", equals: "high" } },
    { kind: "mutual_exclusive", fields: ["done", "count"] },
    { kind: "depends_on", field: "tags", requires: "title" },
  ],
};

function instance(payload: Record<string, unknown>): Instance {
  return { schemaId: "task", schemaVersion: "1.0.0", payload };
}

// ---------------------------------------------------------------------------
// Field type validation
// ---------------------------------------------------------------------------

describe("validator — field types", () => {
  it("accepts a valid instance with all required fields", () => {
    const errors = validateInstance(taskSchema, instance({ title: "Do stuff", priority: "low" }));
    expect(errors).toEqual([]);
  });

  it("rejects missing required fields", () => {
    const errors = validateInstance(taskSchema, instance({ title: "Do stuff" }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path.includes("priority"))).toBe(true);
  });

  it("rejects wrong type for string field", () => {
    const errors = validateInstance(taskSchema, instance({ title: 42, priority: "low" }));
    expect(errors.some((e) => e.path === "payload.title" && e.message.includes("string"))).toBe(true);
  });

  it("rejects invalid enum value", () => {
    const errors = validateInstance(taskSchema, instance({ title: "x", priority: "urgent" }));
    expect(errors.some((e) => e.path === "payload.priority" && e.message.includes("urgent"))).toBe(true);
  });

  it("validates number constraints (min, max, integer)", () => {
    // Negative number
    let errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", count: -1 }));
    expect(errors.some((e) => e.message.includes("below minimum"))).toBe(true);

    // Over max
    errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", count: 200 }));
    expect(errors.some((e) => e.message.includes("exceeds maximum"))).toBe(true);

    // Non-integer
    errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", count: 3.5 }));
    expect(errors.some((e) => e.message.includes("integer"))).toBe(true);

    // Valid number
    errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", count: 5 }));
    expect(errors.filter((e) => e.path.includes("count"))).toEqual([]);
  });

  it("validates boolean fields", () => {
    const errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", done: "yes" }));
    expect(errors.some((e) => e.path === "payload.done" && e.message.includes("boolean"))).toBe(true);
  });

  it("validates array fields with element types and item counts", () => {
    // Wrong element type
    let errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", tags: [1, 2] }));
    expect(errors.some((e) => e.path.includes("tags[") && e.message.includes("string"))).toBe(true);

    // Too many items
    errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", tags: ["a", "b", "c", "d", "e", "f"] }));
    expect(errors.some((e) => e.message.includes("maximum"))).toBe(true);

    // Not an array
    errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", tags: "oops" }));
    expect(errors.some((e) => e.path === "payload.tags" && e.message.includes("array"))).toBe(true);
  });

  it("validates nested object fields", () => {
    // Valid nested object
    let errors = validateInstance(taskSchema, instance({
      title: "x", priority: "low", metadata: { createdBy: "Alice" },
    }));
    expect(errors).toEqual([]);

    // Missing required nested field
    errors = validateInstance(taskSchema, instance({
      title: "x", priority: "low", metadata: { version: 2 },
    }));
    expect(errors.some((e) => e.path.includes("metadata.createdBy"))).toBe(true);

    // Wrong type in nested
    errors = validateInstance(taskSchema, instance({
      title: "x", priority: "low", metadata: { createdBy: 999 },
    }));
    expect(errors.some((e) => e.path.includes("metadata.createdBy"))).toBe(true);
  });

  it("rejects unexpected fields not in schema", () => {
    const errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", foo: "bar" }));
    expect(errors.some((e) => e.path === "payload.foo" && e.message.includes("Unexpected"))).toBe(true);
  });

  it("validates union types", () => {
    const unionSchema: Schema = {
      id: "union-test",
      version: "1.0.0",
      fields: [
        {
          name: "value",
          description: "String or number",
          type: { kind: "union", variants: [{ kind: "string" }, { kind: "number" }] },
          required: true,
        },
      ],
      rules: [],
    };

    // String is valid
    let errors = validateInstance(unionSchema, { schemaId: "union-test", schemaVersion: "1.0.0", payload: { value: "hello" } });
    expect(errors).toEqual([]);

    // Number is valid
    errors = validateInstance(unionSchema, { schemaId: "union-test", schemaVersion: "1.0.0", payload: { value: 42 } });
    expect(errors).toEqual([]);

    // Boolean is not valid
    errors = validateInstance(unionSchema, { schemaId: "union-test", schemaVersion: "1.0.0", payload: { value: true } });
    expect(errors.some((e) => e.message.includes("does not match any variant"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Schema ID / version validation
// ---------------------------------------------------------------------------

describe("validator — schema reference", () => {
  it("rejects mismatched schema id", () => {
    const errors = validateInstance(taskSchema, { schemaId: "wrong", schemaVersion: "1.0.0", payload: { title: "x", priority: "low" } });
    expect(errors.some((e) => e.path === "schemaId")).toBe(true);
  });

  it("rejects mismatched schema version", () => {
    const errors = validateInstance(taskSchema, { schemaId: "task", schemaVersion: "99.0.0", payload: { title: "x", priority: "low" } });
    expect(errors.some((e) => e.path === "schemaVersion")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule validation
// ---------------------------------------------------------------------------

describe("validator — rules", () => {
  it("enforces required_if: count required when priority is high", () => {
    const errors = validateInstance(taskSchema, instance({ title: "x", priority: "high" }));
    expect(errors.some((e) => e.path === "count" && e.message.includes("required"))).toBe(true);
  });

  it("does not require count when priority is not high", () => {
    const errors = validateInstance(taskSchema, instance({ title: "x", priority: "low" }));
    expect(errors.filter((e) => e.path === "count")).toEqual([]);
  });

  it("enforces mutual_exclusive: done and count cannot coexist", () => {
    const errors = validateInstance(taskSchema, instance({ title: "x", priority: "low", done: true, count: 5 }));
    expect(errors.some((e) => e.message.includes("mutually exclusive"))).toBe(true);
  });

  it("enforces depends_on: tags requires title", () => {
    // tags without title — but title is required anyway, so let's use a schema without title required
    const relaxedSchema: Schema = {
      ...taskSchema,
      fields: taskSchema.fields.map((f) => f.name === "title" ? { ...f, required: false } : f),
    };
    const errors = validateInstance(relaxedSchema, { schemaId: "task", schemaVersion: "1.0.0", payload: { priority: "low", tags: ["a"] } });
    expect(errors.some((e) => e.message.includes("requires") && e.message.includes("title"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CandidateInstance validation
// ---------------------------------------------------------------------------

describe("validator — CandidateInstance", () => {
  const candidateSchema: CandidateSchema = {
    baseSchema: taskSchema,
    extensions: [
      {
        id: "ext-assignee",
        description: "Add assignee field",
        newFields: [
          { name: "assignee", description: "Assigned person", type: { kind: "string" }, required: true },
        ],
        newRules: [],
      },
    ],
  };

  it("validates a correct CandidateInstance", () => {
    const candidate: CandidateInstance = {
      schemaId: "task",
      schemaVersion: "1.0.0",
      basePayload: { title: "x", priority: "low" },
      extensionPayload: { assignee: "Bob" },
    };
    const errors = validateCandidateInstance(candidateSchema, candidate);
    expect(errors).toEqual([]);
  });

  it("rejects missing extension fields", () => {
    const candidate: CandidateInstance = {
      schemaId: "task",
      schemaVersion: "1.0.0",
      basePayload: { title: "x", priority: "low" },
      extensionPayload: {},
    };
    const errors = validateCandidateInstance(candidateSchema, candidate);
    expect(errors.some((e) => e.path.includes("assignee"))).toBe(true);
  });

  it("rejects invalid base payload", () => {
    const candidate: CandidateInstance = {
      schemaId: "task",
      schemaVersion: "1.0.0",
      basePayload: { title: 999, priority: "low" },
      extensionPayload: { assignee: "Bob" },
    };
    const errors = validateCandidateInstance(candidateSchema, candidate);
    expect(errors.some((e) => e.path.includes("title"))).toBe(true);
  });
});
