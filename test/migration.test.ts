import { describe, it, expect } from 'vitest';
import { migrateConfig, formatMigrationReport } from '../src/config/migration.js';

describe('migrateConfig', () => {
  it('returns unchanged for a valid config', () => {
    const config = {
      project: { name: 'test' },
      recording: { theme: 'Dracula', fps: 25 },
      annotation: { enabled: true },
      scenarios: [{ name: 'basic', steps: [], depends_on: [] }],
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(false);
    expect(result.steps).toHaveLength(0);
  });

  it('renames terminal_scenarios to scenarios', () => {
    const config = {
      project: { name: 'test' },
      terminal_scenarios: [{ name: 'basic', steps: [] }],
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    expect(result.config.scenarios).toBeDefined();
    expect(result.config.terminal_scenarios).toBeUndefined();
    expect(result.steps.some((s) => s.description.includes('terminal_scenarios'))).toBe(true);
  });

  it('moves top-level theme to recording.theme', () => {
    const config = {
      project: { name: 'test' },
      theme: 'Dracula',
      recording: {},
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    expect((result.config.recording as any).theme).toBe('Dracula');
    expect(result.config.theme).toBeUndefined();
  });

  it('moves top-level format to recording.format', () => {
    const config = {
      project: { name: 'test' },
      format: 'gif',
      recording: {},
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    expect((result.config.recording as any).format).toBe('gif');
    expect(result.config.format).toBeUndefined();
  });

  it('renames ai section to annotation', () => {
    const config = {
      project: { name: 'test' },
      ai: { enabled: true, model: 'claude-sonnet-4-6' },
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    expect(result.config.annotation).toBeDefined();
    expect(result.config.ai).toBeUndefined();
  });

  it('renames recording.framerate to recording.fps', () => {
    const config = {
      project: { name: 'test' },
      recording: { framerate: 30 },
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    expect((result.config.recording as any).fps).toBe(30);
    expect((result.config.recording as any).framerate).toBeUndefined();
  });

  it('moves recording.output_dir to output.dir', () => {
    const config = {
      project: { name: 'test' },
      recording: { output_dir: 'custom-output' },
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    expect((result.config.output as any).dir).toBe('custom-output');
  });

  it('updates deprecated gpt-4-vision model', () => {
    const config = {
      project: { name: 'test' },
      annotation: { model: 'gpt-4-vision' },
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    expect((result.config.annotation as any).model).toBe('claude-sonnet-4-6');
  });

  it('adds depends_on to scenarios missing it', () => {
    const config = {
      project: { name: 'test' },
      scenarios: [
        { name: 'basic', steps: [] },
        { name: 'advanced', steps: [], depends_on: ['basic'] },
      ],
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    const scenarios = result.config.scenarios as Array<{ depends_on?: string[] }>;
    expect(scenarios[0].depends_on).toEqual([]);
    expect(scenarios[1].depends_on).toEqual(['basic']);
  });

  it('does not mutate the original config', () => {
    const config = {
      project: { name: 'test' },
      theme: 'Dracula',
      recording: {},
    };

    migrateConfig(config);
    expect(config.theme).toBe('Dracula'); // Original unchanged
  });

  it('applies multiple migrations at once', () => {
    const config = {
      project: { name: 'test' },
      theme: 'Dracula',
      format: 'gif',
      ai: { model: 'gpt-4-vision' },
      terminal_scenarios: [{ name: 'basic', steps: [] }],
    };

    const result = migrateConfig(config);
    expect(result.changed).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(4);
  });
});

describe('formatMigrationReport', () => {
  it('shows no-op message for unchanged config', () => {
    const report = formatMigrationReport({ config: {}, steps: [], changed: false });
    expect(report).toContain('up to date');
  });

  it('lists migration steps', () => {
    const report = formatMigrationReport({
      config: {},
      steps: [
        { description: 'Renamed "ai" to "annotation"', path: 'annotation' },
        { description: 'Updated model', path: 'annotation.model', oldValue: 'gpt-4-vision', newValue: 'claude-sonnet-4-6' },
      ],
      changed: true,
    });

    expect(report).toContain('2 migration(s)');
    expect(report).toContain('Renamed "ai"');
    expect(report).toContain('gpt-4-vision');
  });
});
