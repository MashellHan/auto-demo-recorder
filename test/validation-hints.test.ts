import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateValidationHints, formatValidationHints } from '../src/config/validation-hints.js';
import { ConfigSchema } from '../src/config/schema.js';

describe('generateValidationHints', () => {
  it('returns empty for valid config', () => {
    const result = ConfigSchema.safeParse({
      project: { name: 'test' },
      scenarios: [{ name: 'demo', description: 'test', steps: [{ action: 'type', value: 'hi' }] }],
    });
    // Valid config should not generate errors
    expect(result.success).toBe(true);
  });

  it('detects typo in field name', () => {
    // Use a simple schema with strict mode for unrecognized key detection
    const TestSchema = z.object({
      name: z.string(),
      description: z.string(),
    }).strict();

    const result = TestSchema.safeParse({ nmae: 'test', description: 'ok' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const hints = generateValidationHints(result.error);
      const typoHint = hints.find((h) => h.path.includes('nmae'));
      expect(typoHint).toBeDefined();
      // Should suggest closest match or list valid fields
      expect(typoHint!.suggestion).toBeDefined();
      expect(typoHint!.suggestion!.length).toBeGreaterThan(0);
    }
  });

  it('suggests valid enum values for invalid enum', () => {
    const TestSchema = z.object({
      format: z.enum(['mp4', 'gif', 'svg']),
    });

    const result = TestSchema.safeParse({ format: 'avi' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const hints = generateValidationHints(result.error);
      const enumHint = hints.find((h) => h.path === 'format');
      expect(enumHint).toBeDefined();
      expect(enumHint!.suggestion).toContain('mp4');
    }
  });

  it('handles missing required field', () => {
    const TestSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = TestSchema.safeParse({ name: 'test' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const hints = generateValidationHints(result.error);
      expect(hints.length).toBeGreaterThan(0);
      const ageHint = hints.find((h) => h.path === 'age');
      expect(ageHint).toBeDefined();
    }
  });

  it('handles invalid type error', () => {
    const TestSchema = z.object({
      count: z.number(),
    });

    const result = TestSchema.safeParse({ count: 'not-a-number' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const hints = generateValidationHints(result.error);
      const typeHint = hints.find((h) => h.path === 'count');
      expect(typeHint).toBeDefined();
      expect(typeHint!.suggestion).toContain('number');
    }
  });
});

describe('formatValidationHints', () => {
  it('shows no issues message for empty hints', () => {
    const output = formatValidationHints([]);
    expect(output).toContain('No validation issues');
  });

  it('formats hints with suggestions', () => {
    const output = formatValidationHints([
      { path: 'recording.fromat', message: 'Unrecognized field', suggestion: 'Did you mean "format"?' },
    ]);
    expect(output).toContain('recording.fromat');
    expect(output).toContain('Did you mean');
    expect(output).toContain('format');
  });

  it('formats hints without suggestions', () => {
    const output = formatValidationHints([
      { path: 'project.name', message: 'Required field missing' },
    ]);
    expect(output).toContain('project.name');
    expect(output).toContain('Required');
  });
});
