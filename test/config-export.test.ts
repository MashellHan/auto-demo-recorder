import { describe, it, expect } from 'vitest';
import { exportConfig, formatExportSummary } from '../src/config/config-export.js';
import { ConfigSchema } from '../src/config/schema.js';

function makeConfig(overrides: Record<string, unknown> = {}): any {
  return ConfigSchema.parse({
    project: { name: 'test-project', description: 'test' },
    scenarios: [
      {
        name: 'basic',
        description: 'Basic test',
        steps: [{ action: 'type', value: 'echo hello' }],
      },
    ],
    ...overrides,
  });
}

describe('exportConfig', () => {
  it('exports to JSON', () => {
    const config = makeConfig();
    const result = exportConfig(config, 'json');
    expect(result.format).toBe('json');
    expect(result.scenarioCount).toBe(1);
    const parsed = JSON.parse(result.content);
    expect(parsed.project.name).toBe('test-project');
  });

  it('exports valid JSON', () => {
    const config = makeConfig();
    const result = exportConfig(config, 'json');
    expect(() => JSON.parse(result.content)).not.toThrow();
  });

  it('exports to TOML-like format', () => {
    const config = makeConfig();
    const result = exportConfig(config, 'toml');
    expect(result.format).toBe('toml');
    expect(result.content).toContain('[project]');
    expect(result.content).toContain('name = "test-project"');
    expect(result.content).toContain('[recording]');
    expect(result.content).toContain('[output]');
    expect(result.content).toContain('[[scenarios]]');
  });

  it('includes tags in TOML', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'tagged',
        description: 'Tagged',
        tags: ['a', 'b'],
        steps: [{ action: 'type', value: 'x' }],
      }],
    });
    const result = exportConfig(config, 'toml');
    expect(result.content).toContain('tags = ["a", "b"]');
  });

  it('includes depends_on in TOML', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'dep',
        description: 'Depends',
        depends_on: ['other'],
        steps: [{ action: 'type', value: 'x' }],
      }],
    });
    const result = exportConfig(config, 'toml');
    expect(result.content).toContain('depends_on = ["other"]');
  });

  it('counts both scenario types', () => {
    const config = makeConfig({
      scenarios: [{ name: 'a', description: 'A', steps: [{ action: 'type', value: 'x' }] }],
      browser_scenarios: [{ name: 'b', description: 'B', url: 'http://localhost', steps: [{ action: 'navigate', value: 'http://localhost' }] }],
    });
    const result = exportConfig(config, 'json');
    expect(result.scenarioCount).toBe(2);
  });

  it('includes recording settings in TOML', () => {
    const config = makeConfig();
    const result = exportConfig(config, 'toml');
    expect(result.content).toContain('width =');
    expect(result.content).toContain('fps =');
    expect(result.content).toContain('parallel =');
  });
});

describe('formatExportSummary', () => {
  it('formats JSON summary', () => {
    const config = makeConfig();
    const result = exportConfig(config, 'json');
    const text = formatExportSummary(result);
    expect(text).toContain('JSON');
    expect(text).toContain('Scenarios: 1');
    expect(text).toContain('bytes');
  });

  it('formats TOML summary', () => {
    const config = makeConfig();
    const result = exportConfig(config, 'toml');
    const text = formatExportSummary(result);
    expect(text).toContain('TOML');
  });
});
