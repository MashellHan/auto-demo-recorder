import { ConfigSchema } from './schema.js';

/**
 * Export the demo-recorder config schema as a JSON Schema object.
 * Useful for IDE autocomplete when editing demo-recorder.yaml files.
 *
 * Uses a lightweight Zod-to-JSON-Schema conversion that covers
 * the subset of Zod features used in ConfigSchema, without requiring
 * an external dependency.
 */
export function exportJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(ConfigSchema);
}

/**
 * Lightweight Zod-to-JSON-Schema converter.
 * Handles the Zod types used in ConfigSchema: objects, arrays, strings,
 * numbers, booleans, enums, defaults, optional, and refinements.
 */
function zodToJsonSchema(schema: any): Record<string, unknown> {
  const jsonSchema: Record<string, unknown> = {
    $schema: 'https://json-schema.org/draft-07/schema#',
    title: 'DemoRecorderConfig',
    description: 'Configuration schema for auto-demo-recorder',
    ...convertZodType(schema),
  };

  return jsonSchema;
}

function convertZodType(schema: any): Record<string, unknown> {
  if (!schema || !schema._def) return { type: 'object' };

  const def = schema._def;
  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodObject':
      return convertObject(def);
    case 'ZodArray':
      return convertArray(def);
    case 'ZodString':
      return convertString(def);
    case 'ZodNumber':
      return convertNumber(def);
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum':
      return { type: 'string', enum: def.values };
    case 'ZodDefault':
      return { ...convertZodType(def.innerType), default: def.defaultValue() };
    case 'ZodOptional':
      return convertZodType(def.innerType);
    case 'ZodEffects':
      // refinements — unwrap inner schema
      return convertZodType(def.schema);
    default:
      return {};
  }
}

function convertObject(def: any): Record<string, unknown> {
  const shape = def.shape();
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = convertZodType(value);

    // Check if field is required (not optional, not default)
    const fieldDef = (value as any)?._def;
    if (fieldDef) {
      const isOptional = fieldDef.typeName === 'ZodOptional';
      const hasDefault = fieldDef.typeName === 'ZodDefault';
      if (!isOptional && !hasDefault) {
        required.push(key);
      }
    }
  }

  const result: Record<string, unknown> = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    result.required = required;
  }

  return result;
}

function convertArray(def: any): Record<string, unknown> {
  return {
    type: 'array',
    items: convertZodType(def.type),
  };
}

function convertString(def: any): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'string' };

  for (const check of def.checks ?? []) {
    if (check.kind === 'url') {
      result.format = 'uri';
    } else if (check.kind === 'email') {
      result.format = 'email';
    } else if (check.kind === 'min') {
      result.minLength = check.value;
    } else if (check.kind === 'max') {
      result.maxLength = check.value;
    }
  }

  return result;
}

function convertNumber(def: any): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'number' };

  for (const check of def.checks ?? []) {
    if (check.kind === 'int') {
      result.type = 'integer';
    } else if (check.kind === 'min') {
      if (check.inclusive) {
        result.minimum = check.value;
      } else {
        result.exclusiveMinimum = check.value;
      }
    } else if (check.kind === 'max') {
      if (check.inclusive) {
        result.maximum = check.value;
      } else {
        result.exclusiveMaximum = check.value;
      }
    }
  }

  return result;
}
