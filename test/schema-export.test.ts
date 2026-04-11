import { describe, it, expect } from 'vitest';
import { exportJsonSchema } from '../src/config/schema-export.js';

describe('exportJsonSchema', () => {
  it('returns valid JSON Schema with required top-level keys', () => {
    const schema = exportJsonSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft-07/schema#');
    expect(schema.title).toBe('DemoRecorderConfig');
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
  });

  it('includes project property as required', () => {
    const schema = exportJsonSchema();
    const properties = schema.properties as Record<string, any>;
    expect(properties.project).toBeDefined();
    expect(properties.project.type).toBe('object');
    expect((schema.required as string[]) ?? []).toContain('project');
  });

  it('includes recording property with defaults', () => {
    const schema = exportJsonSchema();
    const properties = schema.properties as Record<string, any>;
    expect(properties.recording).toBeDefined();
    expect(properties.recording.type).toBe('object');
  });

  it('includes annotation property with model string', () => {
    const schema = exportJsonSchema();
    const properties = schema.properties as Record<string, any>;
    expect(properties.annotation).toBeDefined();
    const annotationProps = properties.annotation.properties;
    expect(annotationProps.model).toBeDefined();
    expect(annotationProps.model.type).toBe('string');
  });

  it('includes scenarios as an array', () => {
    const schema = exportJsonSchema();
    const properties = schema.properties as Record<string, any>;
    expect(properties.scenarios).toBeDefined();
    expect(properties.scenarios.type).toBe('array');
  });

  it('includes browser_scenarios as an array', () => {
    const schema = exportJsonSchema();
    const properties = schema.properties as Record<string, any>;
    expect(properties.browser_scenarios).toBeDefined();
    expect(properties.browser_scenarios.type).toBe('array');
  });

  it('includes output property with dir string', () => {
    const schema = exportJsonSchema();
    const properties = schema.properties as Record<string, any>;
    expect(properties.output).toBeDefined();
    const outputProps = properties.output.properties;
    expect(outputProps.dir).toBeDefined();
    expect(outputProps.dir.type).toBe('string');
  });

  it('recording format is an enum', () => {
    const schema = exportJsonSchema();
    const properties = schema.properties as Record<string, any>;
    const recordingProps = properties.recording.properties;
    expect(recordingProps.format).toBeDefined();
    expect(recordingProps.format.enum).toBeDefined();
    expect(recordingProps.format.enum).toContain('mp4');
    expect(recordingProps.format.enum).toContain('gif');
  });

  it('includes watch property with include array', () => {
    const schema = exportJsonSchema();
    const properties = schema.properties as Record<string, any>;
    expect(properties.watch).toBeDefined();
    const watchProps = properties.watch.properties;
    expect(watchProps.include).toBeDefined();
    expect(watchProps.include.type).toBe('array');
  });

  it('output is valid JSON when stringified', () => {
    const schema = exportJsonSchema();
    const json = JSON.stringify(schema);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
