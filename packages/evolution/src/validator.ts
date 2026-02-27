/**
 * Validator — Schema + Instance → validation errors.
 *
 * Pure logic, no domain-specific knowledge. The validator checks:
 * 1. Payload structure against Schema FieldDefinitions (recursive type checking)
 * 2. Rule constraints (required_if, mutual_exclusive, depends_on)
 *
 * Supports both Instance (Current) and CandidateInstance (Candidate) validation.
 */

import type { Schema, CandidateSchema, FieldDefinition, FieldType, Rule } from "./types/schema.js";
import type { Instance, CandidateInstance, Payload } from "./types/instance.js";
import type { ValidationError } from "./types/errors.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Validate an Instance against a Schema. Returns [] if valid. */
export function validateInstance(
  schema: Schema,
  instance: Instance,
): ReadonlyArray<ValidationError> {
  const errors: ValidationError[] = [];

  if (instance.schemaId !== schema.id) {
    errors.push(validationError("schemaId", `Expected schema "${schema.id}", got "${instance.schemaId}"`));
  }
  if (instance.schemaVersion !== schema.version) {
    errors.push(validationError("schemaVersion", `Expected version "${schema.version}", got "${instance.schemaVersion}"`));
  }

  errors.push(...validatePayload(schema.fields, instance.payload, "payload"));
  errors.push(...validateRules(schema.rules, instance.payload));

  return errors;
}

/** Validate a CandidateInstance against a CandidateSchema. Returns [] if valid. */
export function validateCandidateInstance(
  candidateSchema: CandidateSchema,
  candidate: CandidateInstance,
): ReadonlyArray<ValidationError> {
  const errors: ValidationError[] = [];
  const base = candidateSchema.baseSchema;

  if (candidate.schemaId !== base.id) {
    errors.push(validationError("schemaId", `Expected schema "${base.id}", got "${candidate.schemaId}"`));
  }

  // Validate basePayload against base schema fields
  errors.push(...validatePayload(base.fields, candidate.basePayload, "basePayload"));

  // Validate extensionPayload against extension fields
  const extensionFields = candidateSchema.extensions.flatMap((ext) => [...ext.newFields]);
  errors.push(...validatePayload(extensionFields, candidate.extensionPayload, "extensionPayload"));

  // Validate rules: base rules apply to basePayload, extension rules apply to merged payload
  errors.push(...validateRules(base.rules, candidate.basePayload));

  const extensionRules = candidateSchema.extensions.flatMap((ext) => [...ext.newRules]);
  const mergedPayload = { ...candidate.basePayload, ...candidate.extensionPayload };
  errors.push(...validateRules(extensionRules, mergedPayload));

  return errors;
}

// ---------------------------------------------------------------------------
// Payload validation — recursive structural checking
// ---------------------------------------------------------------------------

function validatePayload(
  fields: ReadonlyArray<FieldDefinition>,
  payload: Payload,
  pathPrefix: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check each defined field
  for (const field of fields) {
    const path = `${pathPrefix}.${field.name}`;
    const value = payload[field.name];

    if (value === undefined || value === null) {
      if (field.required && field.defaultValue === undefined) {
        errors.push(validationError(path, `Required field "${field.name}" is missing`));
      }
      continue;
    }

    errors.push(...validateFieldType(field.type, value, path));
  }

  // Check for unexpected fields not in the schema
  const definedNames = new Set(fields.map((f) => f.name));
  for (const key of Object.keys(payload)) {
    if (!definedNames.has(key)) {
      errors.push(validationError(
        `${pathPrefix}.${key}`,
        `Unexpected field "${key}" not defined in schema`,
        payload[key],
      ));
    }
  }

  return errors;
}

function validateFieldType(
  type: FieldType,
  value: unknown,
  path: string,
): ValidationError[] {
  switch (type.kind) {
    case "string":
      return validateString(type, value, path);
    case "number":
      return validateNumber(type, value, path);
    case "boolean":
      return validateBoolean(value, path);
    case "object":
      return validateObject(type, value, path);
    case "array":
      return validateArray(type, value, path);
    case "union":
      return validateUnion(type, value, path);
  }
}

function validateString(
  type: { readonly enum?: ReadonlyArray<string> },
  value: unknown,
  path: string,
): ValidationError[] {
  if (typeof value !== "string") {
    return [validationError(path, `Expected string, got ${typeLabel(value)}`, value)];
  }
  if (type.enum && !type.enum.includes(value)) {
    return [validationError(path, `Value "${value}" is not one of: ${type.enum.join(", ")}`, value)];
  }
  return [];
}

function validateNumber(
  type: { readonly min?: number; readonly max?: number; readonly integer?: boolean },
  value: unknown,
  path: string,
): ValidationError[] {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return [validationError(path, `Expected number, got ${typeLabel(value)}`, value)];
  }
  const errors: ValidationError[] = [];
  if (type.integer && !Number.isInteger(value)) {
    errors.push(validationError(path, `Expected integer, got ${value}`, value));
  }
  if (type.min !== undefined && value < type.min) {
    errors.push(validationError(path, `Value ${value} is below minimum ${type.min}`, value));
  }
  if (type.max !== undefined && value > type.max) {
    errors.push(validationError(path, `Value ${value} exceeds maximum ${type.max}`, value));
  }
  return errors;
}

function validateBoolean(value: unknown, path: string): ValidationError[] {
  if (typeof value !== "boolean") {
    return [validationError(path, `Expected boolean, got ${typeLabel(value)}`, value)];
  }
  return [];
}

function validateObject(
  type: { readonly fields: ReadonlyArray<FieldDefinition> },
  value: unknown,
  path: string,
): ValidationError[] {
  if (!isPlainObject(value)) {
    return [validationError(path, `Expected object, got ${typeLabel(value)}`, value)];
  }
  return validatePayload(type.fields, value as Payload, path);
}

function validateArray(
  type: { readonly element: FieldType; readonly minItems?: number; readonly maxItems?: number },
  value: unknown,
  path: string,
): ValidationError[] {
  if (!Array.isArray(value)) {
    return [validationError(path, `Expected array, got ${typeLabel(value)}`, value)];
  }
  const errors: ValidationError[] = [];
  if (type.minItems !== undefined && value.length < type.minItems) {
    errors.push(validationError(path, `Array has ${value.length} items, minimum is ${type.minItems}`, value));
  }
  if (type.maxItems !== undefined && value.length > type.maxItems) {
    errors.push(validationError(path, `Array has ${value.length} items, maximum is ${type.maxItems}`, value));
  }
  for (let i = 0; i < value.length; i++) {
    errors.push(...validateFieldType(type.element, value[i], `${path}[${i}]`));
  }
  return errors;
}

function validateUnion(
  type: { readonly variants: ReadonlyArray<FieldType> },
  value: unknown,
  path: string,
): ValidationError[] {
  // Value is valid if it passes at least one variant
  for (const variant of type.variants) {
    const variantErrors = validateFieldType(variant, value, path);
    if (variantErrors.length === 0) {
      return [];
    }
  }
  const variantKinds = type.variants.map((v) => v.kind).join(" | ");
  return [validationError(path, `Value does not match any variant: ${variantKinds}`, value)];
}

// ---------------------------------------------------------------------------
// Rule validation
// ---------------------------------------------------------------------------

function validateRules(
  rules: ReadonlyArray<Rule>,
  payload: Payload,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const rule of rules) {
    switch (rule.kind) {
      case "required_if":
        errors.push(...validateRequiredIf(rule, payload));
        break;
      case "mutual_exclusive":
        errors.push(...validateMutualExclusive(rule, payload));
        break;
      case "depends_on":
        errors.push(...validateDependsOn(rule, payload));
        break;
    }
  }
  return errors;
}

function validateRequiredIf(
  rule: { readonly field: string; readonly when: { readonly field: string; readonly equals: unknown } },
  payload: Payload,
): ValidationError[] {
  const conditionValue = payload[rule.when.field];
  if (conditionValue === rule.when.equals) {
    const targetValue = payload[rule.field];
    if (targetValue === undefined || targetValue === null) {
      return [validationError(
        rule.field,
        `Field "${rule.field}" is required when "${rule.when.field}" equals ${JSON.stringify(rule.when.equals)}`,
      )];
    }
  }
  return [];
}

function validateMutualExclusive(
  rule: { readonly fields: ReadonlyArray<string> },
  payload: Payload,
): ValidationError[] {
  const presentFields = rule.fields.filter(
    (f) => payload[f] !== undefined && payload[f] !== null,
  );
  if (presentFields.length > 1) {
    return [validationError(
      presentFields.join(","),
      `Fields are mutually exclusive, but multiple are present: ${presentFields.join(", ")}`,
    )];
  }
  return [];
}

function validateDependsOn(
  rule: { readonly field: string; readonly requires: string },
  payload: Payload,
): ValidationError[] {
  const fieldPresent = payload[rule.field] !== undefined && payload[rule.field] !== null;
  const requiresPresent = payload[rule.requires] !== undefined && payload[rule.requires] !== null;
  if (fieldPresent && !requiresPresent) {
    return [validationError(
      rule.field,
      `Field "${rule.field}" requires "${rule.requires}" to be present`,
    )];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validationError(path: string, message: string, value?: unknown): ValidationError {
  return { kind: "validation", path, message, value };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeLabel(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
