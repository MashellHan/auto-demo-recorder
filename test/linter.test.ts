import { describe, it, expect } from 'vitest';
import { lintConfig, formatLintReport } from '../src/config/linter.js';
import { ConfigSchema } from '../src/config/schema.js';

function makeConfig(overrides: Record<string, unknown> = {}): any {
  // Use parse for valid configs, manual merge for edge cases
  const base = ConfigSchema.parse({
    project: { name: 'test-project', description: 'test' },
    scenarios: [
      {
        name: 'basic',
        description: 'Basic scenario',
        steps: [{ action: 'type', value: 'echo hello' }],
      },
    ],
  });
  // Apply overrides directly to bypass schema validation for linter edge cases
  return { ...base, ...overrides };
}

describe('lintConfig', () => {
  it('passes for a clean config', () => {
    const config = makeConfig();
    const result = lintConfig(config);
    expect(result.passed).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('reports error when no scenarios are defined', () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = lintConfig(config);
    expect(result.passed).toBe(false);
    expect(result.errors).toBe(1);
    const rule = result.warnings.find((w) => w.rule === 'no-scenarios');
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('error');
  });

  it('reports error for duplicate scenario names', () => {
    const config = makeConfig({
      scenarios: [
        { name: 'dup', description: 'first', steps: [{ action: 'type', value: 'x' }] },
        { name: 'dup', description: 'second', steps: [{ action: 'type', value: 'y' }] },
      ],
    });
    const result = lintConfig(config);
    const rule = result.warnings.find((w) => w.rule === 'duplicate-scenario-name');
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('error');
  });

  it('warns about high fps', () => {
    const config = makeConfig();
    config.annotation = { ...config.annotation, extract_fps: 60 };
    const result = lintConfig(config);
    const rule = result.warnings.find((w) => w.rule === 'high-fps');
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('warning');
  });

  it('does not warn about normal fps', () => {
    const config = makeConfig();
    config.annotation = { ...config.annotation, extract_fps: 5 };
    const result = lintConfig(config);
    const rule = result.warnings.find((w) => w.rule === 'high-fps');
    expect(rule).toBeUndefined();
  });

  it('warns about short max_duration', () => {
    const config = makeConfig();
    config.recording = { ...config.recording, max_duration: 5 };
    const result = lintConfig(config);
    const rule = result.warnings.find((w) => w.rule === 'short-max-duration');
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('warning');
  });

  it('reports info for unknown theme', () => {
    const config = makeConfig();
    config.recording = { ...config.recording, theme: 'nonexistent-theme-xyz' };
    const result = lintConfig(config);
    const rule = result.warnings.find((w) => w.rule === 'unknown-theme');
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('info');
  });

  it('does not flag known themes', () => {
    const config = makeConfig();
    config.recording = { ...config.recording, theme: 'Dracula' };
    const result = lintConfig(config);
    const rule = result.warnings.find((w) => w.rule === 'unknown-theme');
    expect(rule).toBeUndefined();
  });

  it('returns summary counts', () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    config.recording = { ...config.recording, max_duration: 3 };
    const result = lintConfig(config);
    expect(result.errors).toBeGreaterThanOrEqual(1);
    expect(result.warningCount).toBeGreaterThanOrEqual(1);
  });
});

describe('formatLintReport', () => {
  it('formats clean config', () => {
    const config = makeConfig();
    const result = lintConfig(config);
    const text = formatLintReport(result);
    expect(text).toContain('All checks passed');
  });

  it('formats warnings with icons', () => {
    const config = makeConfig({
      recording: { max_duration: 5 },
    });
    const result = lintConfig(config);
    const text = formatLintReport(result);
    expect(text).toContain('Config Lint Report');
    expect(text).toContain('[WARNING]');
    expect(text).toContain('short-max-duration');
  });

  it('formats errors with FAIL result', () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = lintConfig(config);
    const text = formatLintReport(result);
    expect(text).toContain('[ERROR]');
    expect(text).toContain('FAIL');
  });

  it('includes suggestions', () => {
    const config = makeConfig();
    config.annotation = { ...config.annotation, extract_fps: 60 };
    const result = lintConfig(config);
    const text = formatLintReport(result);
    expect(text).toContain('→');
  });
});
