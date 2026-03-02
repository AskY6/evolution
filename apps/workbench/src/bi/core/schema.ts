/**
 * BI Schema vocabulary — field types, field definitions, rules, BiSchema, BiExtension.
 *
 * Also exports the biSchemaV010 constant (the initial BI Dashboard schema).
 */

// ---------------------------------------------------------------------------
// BI Schema vocabulary — FieldType, FieldDefinition, Rule
// ---------------------------------------------------------------------------

/** Leaf type: string with optional constraints. */
export interface BiStringType {
  readonly kind: "string";
  readonly enum?: ReadonlyArray<string>;
}

/** Leaf type: number with optional range. */
export interface BiNumberType {
  readonly kind: "number";
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

/** Leaf type: boolean. */
export interface BiBooleanType {
  readonly kind: "boolean";
}

/** Composite type: nested object with its own fields. */
export interface BiObjectType {
  readonly kind: "object";
  readonly fields: ReadonlyArray<BiFieldDefinition>;
}

/** Collection type: ordered list of a single element type. */
export interface BiArrayType {
  readonly kind: "array";
  readonly element: BiFieldType;
  readonly minItems?: number;
  readonly maxItems?: number;
}

/** Union type: value must conform to exactly one of the variants. */
export interface BiUnionType {
  readonly kind: "union";
  readonly variants: ReadonlyArray<BiFieldType>;
}

/** All possible BI field type descriptors. */
export type BiFieldType =
  | BiStringType
  | BiNumberType
  | BiBooleanType
  | BiObjectType
  | BiArrayType
  | BiUnionType;

/** A single field that a BI Instance payload may (or must) contain. */
export interface BiFieldDefinition {
  readonly name: string;
  readonly description: string;
  readonly type: BiFieldType;
  readonly required: boolean;
  readonly defaultValue?: unknown;
}

/** Field A is required when field B has a specific value. */
export interface BiRequiredIfRule {
  readonly kind: "required_if";
  readonly field: string;
  readonly when: { readonly field: string; readonly equals: unknown };
}

/** At most one of these fields may be present. */
export interface BiMutualExclusiveRule {
  readonly kind: "mutual_exclusive";
  readonly fields: ReadonlyArray<string>;
}

/** Field A can only be present when field B is also present. */
export interface BiDependsOnRule {
  readonly kind: "depends_on";
  readonly field: string;
  readonly requires: string;
}

/** All possible BI rule types. */
export type BiRule = BiRequiredIfRule | BiMutualExclusiveRule | BiDependsOnRule;

// ---------------------------------------------------------------------------
// BiSchema — BI domain's concrete Schema (structurally extends Schema)
// ---------------------------------------------------------------------------

/**
 * BI-specific schema with field definitions and rules.
 *
 * Structurally satisfies the framework's Schema interface (has id + version),
 * and extends it with BI-specific vocabulary (fields + rules).
 */
export interface BiSchema {
  readonly id: string;
  readonly version: string;
  readonly fields: ReadonlyArray<BiFieldDefinition>;
  readonly rules: ReadonlyArray<BiRule>;
}

// ---------------------------------------------------------------------------
// BiExtension — BI domain's concrete Extension (structurally extends Extension)
// ---------------------------------------------------------------------------

/**
 * BI-specific schema extension with new fields and rules.
 *
 * Structurally satisfies the framework's Extension interface (has id + description),
 * and extends it with BI-specific additions (newFields + newRules).
 * At runtime, extensions are passed as Extension to the framework, and the
 * BiAdapter casts them back to BiExtension to access the extra properties.
 */
export interface BiExtension {
  readonly id: string;
  readonly description: string;
  readonly newFields: ReadonlyArray<BiFieldDefinition>;
  readonly newRules: ReadonlyArray<BiRule>;
}

// ---------------------------------------------------------------------------
// biSchemaV010 — initial BI Dashboard schema constant
// ---------------------------------------------------------------------------

/**
 * Initial BI Dashboard schema v0.1.0.
 *
 * Defines the core vocabulary for a Dashboard: title, grid layout,
 * and an array of bar/line chart panels. Shared filters and data
 * bindings are intentionally omitted at v0.1.0 — they become
 * candidates for the first round of schema extensions.
 */
export const biSchemaV010: BiSchema = {
  id: "bi-dashboard",
  version: "0.1.0",
  fields: [
    {
      name: "title",
      description: "Dashboard title displayed at the top",
      type: { kind: "string" },
      required: true,
    },
    {
      name: "layout",
      description: "Grid layout defining the number of columns and rows",
      type: {
        kind: "object",
        fields: [
          {
            name: "columns",
            description: "Number of grid columns (1–4)",
            type: { kind: "number", min: 1, max: 4, integer: true },
            required: true,
          },
          {
            name: "rows",
            description: "Number of grid rows (1–10)",
            type: { kind: "number", min: 1, max: 10, integer: true },
            required: true,
          },
        ],
      },
      required: true,
    },
    {
      name: "charts",
      description: "Ordered list of chart panels in the dashboard",
      type: {
        kind: "array",
        element: {
          kind: "object",
          fields: [
            {
              name: "id",
              description: "Unique chart identifier within the dashboard",
              type: { kind: "string" },
              required: true,
            },
            {
              name: "chartType",
              description: "Visualization type for this panel",
              type: { kind: "string", enum: ["bar", "line", "pie"] },
              required: true,
            },
            {
              name: "title",
              description: "Optional chart-level title",
              type: { kind: "string" },
              required: false,
            },
            {
              name: "position",
              description: "Grid position and span for this panel",
              type: {
                kind: "object",
                fields: [
                  {
                    name: "col",
                    description: "Starting column (1-based)",
                    type: { kind: "number", min: 1, integer: true },
                    required: true,
                  },
                  {
                    name: "row",
                    description: "Starting row (1-based)",
                    type: { kind: "number", min: 1, integer: true },
                    required: true,
                  },
                  {
                    name: "colSpan",
                    description: "Number of columns this panel occupies",
                    type: { kind: "number", min: 1, max: 4, integer: true },
                    required: true,
                  },
                  {
                    name: "rowSpan",
                    description: "Number of rows this panel occupies",
                    type: { kind: "number", min: 1, integer: true },
                    required: true,
                  },
                ],
              },
              required: true,
            },
            {
              name: "dataSource",
              description: "Data configuration: metrics, dimensions, optional filters and sort",
              type: {
                kind: "object",
                fields: [
                  {
                    name: "metrics",
                    description: "Quantitative fields to measure (y-axis values)",
                    type: { kind: "array", element: { kind: "string" }, minItems: 1 },
                    required: true,
                  },
                  {
                    name: "dimensions",
                    description: "Categorical fields for grouping (x-axis labels)",
                    type: { kind: "array", element: { kind: "string" } },
                    required: true,
                  },
                ],
              },
              required: true,
            },
            {
              name: "xAxis",
              description: "X-axis configuration (omit for pie charts)",
              type: {
                kind: "object",
                fields: [
                  {
                    name: "field",
                    description: "Data field mapped to the x-axis",
                    type: { kind: "string" },
                    required: true,
                  },
                  {
                    name: "label",
                    description: "Axis label shown on the chart",
                    type: { kind: "string" },
                    required: false,
                  },
                ],
              },
              required: false,
            },
            {
              name: "yAxis",
              description: "Y-axis configuration (omit for pie charts)",
              type: {
                kind: "object",
                fields: [
                  {
                    name: "field",
                    description: "Data field mapped to the y-axis",
                    type: { kind: "string" },
                    required: true,
                  },
                  {
                    name: "label",
                    description: "Axis label shown on the chart",
                    type: { kind: "string" },
                    required: false,
                  },
                ],
              },
              required: false,
            },
            {
              name: "series",
              description: "Series (data layers) within the chart panel",
              type: {
                kind: "array",
                element: {
                  kind: "object",
                  fields: [
                    {
                      name: "name",
                      description: "Series display name (shown in legend)",
                      type: { kind: "string" },
                      required: true,
                    },
                    {
                      name: "field",
                      description: "Data field this series renders",
                      type: { kind: "string" },
                      required: true,
                    },
                    {
                      name: "color",
                      description: "Optional hex color for this series",
                      type: { kind: "string" },
                      required: false,
                    },
                  ],
                },
                minItems: 1,
              },
              required: true,
            },
          ],
        },
        minItems: 1,
      },
      required: true,
    },
  ],
  rules: [
    {
      kind: "depends_on",
      field: "xAxis",
      requires: "chartType",
    },
  ],
};
