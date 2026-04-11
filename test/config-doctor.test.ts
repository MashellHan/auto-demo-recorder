import { describe, it, expect } from 'vitest';
import { diagnoseConfig, formatDoctorResult } from '../src/config/config-doctor.js';
import { ConfigSchema } from '../src/config/schema.js';

function makeConfig(overrides: Record<string, unknown> = {}): any {
  const base = ConfigSchema.parse({
    project: { name: 'test-project', description: 'test' },
    scenarios: [
      {
        name: 'basic',
        description: 'Basic test',
        steps: [
          { action: 'type', value: 'echo hello' },
          { action: 'key', value: 'Enter' },
          { action: 'sleep', value: '2s' },
        ],
      },
    ],
  });
  return { ...base, ...overrides };
}

describe('diagnoseConfig', () => {
  it('passes a healthy config', () => {
    const config = makeConfig();
    const result = diagnoseConfig(config);
    expect(result.passed).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it('detects unknown dependency', () => {
    const config = makeConfig({
      scenarios: [
        {
          name: 'a',
          description: 'A',
          steps: [{ action: 'type', value: 'x' }],
          depends_on: ['nonexistent'],
        },
      ],
    });
    const result = diagnoseConfig(config);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    expect(result.passed).toBe(false);
    const dep = result.diagnostics.find((d) => d.category === 'dependency' && d.severity === 'error');
    expect(dep).toBeDefined();
    expect(dep!.message).toContain('nonexistent');
  });

  it('detects dependency cycle', () => {
    const config = makeConfig({
      scenarios: [
        { name: 'a', description: 'A', steps: [{ action: 'type', value: 'x' }], depends_on: ['b'] },
        { name: 'b', description: 'B', steps: [{ action: 'type', value: 'x' }], depends_on: ['a'] },
      ],
    });
    const result = diagnoseConfig(config);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    const cycle = result.diagnostics.find((d) => d.message.includes('cycle'));
    expect(cycle).toBeDefined();
  });

  it('warns about long scenarios', () => {
    const steps = Array.from({ length: 20 }, () => ({ action: 'sleep', value: '5s' }));
    const config = makeConfig({
      scenarios: [
        { name: 'long', description: 'Long scenario', steps },
      ],
    });
    const result = diagnoseConfig(config);
    const perf = result.diagnostics.find((d) => d.category === 'performance' && d.severity === 'warning');
    expect(perf).toBeDefined();
    expect(perf!.message).toContain('splitting');
  });

  it('warns about very short scenarios', () => {
    const config = makeConfig({
      scenarios: [
        {
          name: 'tiny',
          description: 'Tiny',
          steps: [{ action: 'key', value: 'Enter' }],
        },
      ],
    });
    const result = diagnoseConfig(config);
    const info = result.diagnostics.find((d) => d.message.includes('<1s'));
    expect(info).toBeDefined();
  });

  it('warns about high FPS', () => {
    const config = makeConfig({
      recording: { width: 80, height: 24, fps: 60, parallel: false, workers: 1 },
    });
    const result = diagnoseConfig(config);
    const fps = result.diagnostics.find((d) => d.message.includes('FPS'));
    expect(fps).toBeDefined();
  });

  it('warns about excess workers', () => {
    const config = makeConfig({
      recording: { width: 80, height: 24, fps: 10, parallel: true, max_workers: 10 },
    });
    const result = diagnoseConfig(config);
    const workers = result.diagnostics.find((d) => d.message.includes('Workers'));
    expect(workers).toBeDefined();
  });

  it('detects many untagged scenarios', () => {
    const scenarios = Array.from({ length: 5 }, (_, i) => ({
      name: `scenario-${i}`,
      description: `Scenario ${i}`,
      steps: [{ action: 'type', value: 'x' }],
    }));
    const config = makeConfig({ scenarios });
    const result = diagnoseConfig(config);
    const untagged = result.diagnostics.find((d) => d.message.includes('without tags'));
    expect(untagged).toBeDefined();
  });

  it('detects long scenario names', () => {
    const config = makeConfig({
      scenarios: [
        {
          name: 'this-is-an-extremely-long-scenario-name-that-exceeds-thirty-characters',
          description: 'Long name',
          steps: [{ action: 'type', value: 'x' }],
        },
      ],
    });
    const result = diagnoseConfig(config);
    const long = result.diagnostics.find((d) => d.message.includes('long name'));
    expect(long).toBeDefined();
  });

  it('handles empty scenarios', () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = diagnoseConfig(config);
    expect(result.passed).toBe(true);
  });
});

describe('formatDoctorResult', () => {
  it('formats healthy result', () => {
    const config = makeConfig();
    const result = diagnoseConfig(config);
    const text = formatDoctorResult(result);
    expect(text).toContain('Config Doctor');
    expect(text).toContain('healthy');
  });

  it('formats diagnostics with categories', () => {
    const config = makeConfig({
      recording: { width: 80, height: 24, fps: 60, parallel: false, workers: 1 },
    });
    const result = diagnoseConfig(config);
    const text = formatDoctorResult(result);
    expect(text).toContain('Config Doctor');
    expect(text).toContain('PERFORMANCE');
  });

  it('shows summary counts', () => {
    const config = makeConfig({
      scenarios: [
        { name: 'a', description: 'A', steps: [{ action: 'type', value: 'x' }], depends_on: ['nonexistent'] },
      ],
    });
    const result = diagnoseConfig(config);
    const text = formatDoctorResult(result);
    expect(text).toContain('errors');
    expect(text).toContain('FAILED');
  });

  it('shows PASSED for clean config', () => {
    const config = makeConfig();
    const result = diagnoseConfig(config);
    const text = formatDoctorResult(result);
    // Clean config shows healthy, not PASSED/FAILED summary
    expect(text).toContain('healthy');
  });
});
