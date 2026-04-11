import { describe, it, expect } from 'vitest';
import { compareConfigs, formatComparisonReport } from '../src/config/config-comparison.js';
import type { Config } from '../src/config/schema.js';

/** Minimal valid config fixture for testing. */
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    project: { name: 'test-project' },
    recording: {
      width: 800,
      height: 600,
      fps: 30,
      theme: 'Monokai',
      format: 'mp4',
      backend: 'vhs',
      parallel: false,
      max_workers: 2,
      max_duration: 120,
    },
    output: {
      dir: './recordings',
      keep_raw: false,
      keep_frames: false,
      record_mode: 'always',
    },
    annotation: {
      enabled: false,
      model: 'gpt-4o-mini',
      extract_fps: 2,
      language: 'en',
    },
    scenarios: [
      {
        name: 'basic',
        description: 'Basic scenario',
        steps: [{ type: 'type', value: 'echo hello' }],
        tags: ['demo'],
      },
    ],
    browser_scenarios: [],
    ...overrides,
  } as Config;
}

describe('compareConfigs', () => {
  it('reports identical configs', () => {
    const config = makeConfig();
    const result = compareConfigs(config, config);
    expect(result.identical).toBe(true);
    expect(result.changes.length).toBe(0);
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
    expect(result.summary.modified).toBe(0);
  });

  it('detects added scenario', () => {
    const a = makeConfig();
    const b = makeConfig({
      scenarios: [
        ...a.scenarios,
        {
          name: 'advanced',
          description: 'Advanced scenario',
          steps: [{ type: 'type', value: 'echo advanced' }],
        },
      ],
    });
    const result = compareConfigs(a, b);
    expect(result.identical).toBe(false);
    expect(result.summary.added).toBe(1);
    const added = result.changes.find((c) => c.type === 'added' && c.path === 'scenarios.advanced');
    expect(added).toBeDefined();
    expect(added!.description).toContain('New scenario');
  });

  it('detects removed scenario', () => {
    const a = makeConfig();
    const b = makeConfig({ scenarios: [] });
    const result = compareConfigs(a, b);
    expect(result.summary.removed).toBe(1);
    const removed = result.changes.find((c) => c.type === 'removed');
    expect(removed).toBeDefined();
    expect(removed!.description).toContain('Removed scenario');
    expect(removed!.oldValue).toBe('basic');
  });

  it('detects modified scenario description', () => {
    const a = makeConfig();
    const b = makeConfig({
      scenarios: [
        { ...a.scenarios[0], description: 'Updated description' },
      ],
    });
    const result = compareConfigs(a, b);
    const mod = result.changes.find((c) => c.path === 'scenarios.basic.description');
    expect(mod).toBeDefined();
    expect(mod!.type).toBe('modified');
    expect(mod!.oldValue).toBe('Basic scenario');
    expect(mod!.newValue).toBe('Updated description');
  });

  it('detects modified step count', () => {
    const a = makeConfig();
    const b = makeConfig({
      scenarios: [
        {
          ...a.scenarios[0],
          steps: [
            { type: 'type', value: 'echo hello' },
            { type: 'type', value: 'echo world' },
          ],
        },
      ],
    });
    const result = compareConfigs(a, b);
    const mod = result.changes.find((c) => c.path === 'scenarios.basic.steps');
    expect(mod).toBeDefined();
    expect(mod!.description).toContain('1');
    expect(mod!.description).toContain('2');
  });

  it('detects modified tags', () => {
    const a = makeConfig();
    const b = makeConfig({
      scenarios: [
        { ...a.scenarios[0], tags: ['demo', 'new-tag'] },
      ],
    });
    const result = compareConfigs(a, b);
    const mod = result.changes.find((c) => c.path === 'scenarios.basic.tags');
    expect(mod).toBeDefined();
    expect(mod!.type).toBe('modified');
  });

  it('detects added browser scenario', () => {
    const a = makeConfig();
    const b = makeConfig({
      browser_scenarios: [
        { name: 'web-test', description: 'Browser test', url: 'http://localhost', steps: [] },
      ],
    });
    const result = compareConfigs(a, b);
    const added = result.changes.find((c) => c.path === 'browser_scenarios.web-test');
    expect(added).toBeDefined();
    expect(added!.description).toContain('New browser scenario');
  });

  it('detects removed browser scenario', () => {
    const a = makeConfig({
      browser_scenarios: [
        { name: 'web-test', description: 'Browser test', url: 'http://localhost', steps: [] },
      ],
    });
    const b = makeConfig();
    const result = compareConfigs(a, b);
    const removed = result.changes.find((c) => c.path === 'browser_scenarios.web-test');
    expect(removed).toBeDefined();
    expect(removed!.type).toBe('removed');
  });

  it('detects recording setting changes', () => {
    const a = makeConfig();
    const b = makeConfig({
      recording: { ...a.recording, fps: 60, width: 1920 },
    } as Partial<Config>);
    const result = compareConfigs(a, b);
    const fpsMod = result.changes.find((c) => c.path === 'recording.fps');
    expect(fpsMod).toBeDefined();
    expect(fpsMod!.oldValue).toBe(30);
    expect(fpsMod!.newValue).toBe(60);
    const widthMod = result.changes.find((c) => c.path === 'recording.width');
    expect(widthMod).toBeDefined();
  });

  it('detects output setting changes', () => {
    const a = makeConfig();
    const b = makeConfig({
      output: { ...a.output, dir: './new-output', keep_raw: true },
    } as Partial<Config>);
    const result = compareConfigs(a, b);
    const dirMod = result.changes.find((c) => c.path === 'output.dir');
    expect(dirMod).toBeDefined();
    expect(dirMod!.oldValue).toBe('./recordings');
    expect(dirMod!.newValue).toBe('./new-output');
  });

  it('detects annotation setting changes', () => {
    const a = makeConfig();
    const b = makeConfig({
      annotation: { ...a.annotation, enabled: true, model: 'gpt-4o' },
    } as Partial<Config>);
    const result = compareConfigs(a, b);
    const enabledMod = result.changes.find((c) => c.path === 'annotation.enabled');
    expect(enabledMod).toBeDefined();
    const modelMod = result.changes.find((c) => c.path === 'annotation.model');
    expect(modelMod).toBeDefined();
  });

  it('detects project name change', () => {
    const a = makeConfig();
    const b = makeConfig({ project: { name: 'new-project' } });
    const result = compareConfigs(a, b);
    const mod = result.changes.find((c) => c.path === 'project.name');
    expect(mod).toBeDefined();
    expect(mod!.type).toBe('modified');
    expect(mod!.oldValue).toBe('test-project');
    expect(mod!.newValue).toBe('new-project');
  });

  it('reports correct summary counts', () => {
    const a = makeConfig();
    const b = makeConfig({
      project: { name: 'changed' },
      scenarios: [
        { name: 'new-scenario', description: 'New', steps: [] },
      ],
    });
    const result = compareConfigs(a, b);
    // 'basic' removed, 'new-scenario' added, project.name modified
    expect(result.summary.added).toBe(1);
    expect(result.summary.removed).toBe(1);
    expect(result.summary.modified).toBeGreaterThanOrEqual(1);
    expect(result.identical).toBe(false);
  });

  it('handles scenarios with no tags', () => {
    const a = makeConfig({
      scenarios: [
        { name: 'no-tags', description: 'No tags', steps: [] },
      ],
    });
    const b = makeConfig({
      scenarios: [
        { name: 'no-tags', description: 'No tags', steps: [] },
      ],
    });
    const result = compareConfigs(a, b);
    // No tag change should be detected when both have no tags
    const tagChange = result.changes.find((c) => c.path.includes('tags'));
    expect(tagChange).toBeUndefined();
  });

  it('detects multiple simultaneous changes', () => {
    const a = makeConfig();
    const b = makeConfig({
      project: { name: 'different' },
      recording: { ...a.recording, fps: 60 } as Config['recording'],
      output: { ...a.output, keep_raw: true } as Config['output'],
      scenarios: [
        ...a.scenarios,
        { name: 'extra', description: 'Extra', steps: [] },
      ],
    });
    const result = compareConfigs(a, b);
    expect(result.changes.length).toBeGreaterThanOrEqual(4);
    expect(result.summary.added).toBeGreaterThanOrEqual(1);
    expect(result.summary.modified).toBeGreaterThanOrEqual(3);
  });
});

describe('formatComparisonReport', () => {
  it('formats identical configs', () => {
    const config = makeConfig();
    const report = compareConfigs(config, config);
    const text = formatComparisonReport(report);
    expect(text).toContain('identical');
    expect(text).toContain('Config Comparison Report');
  });

  it('formats report with changes', () => {
    const a = makeConfig();
    const b = makeConfig({
      scenarios: [
        ...a.scenarios,
        { name: 'new', description: 'New', steps: [] },
      ],
    });
    const report = compareConfigs(a, b);
    const text = formatComparisonReport(report);
    expect(text).toContain('Added');
    expect(text).toContain('+');
    expect(text).toContain('New scenario');
    expect(text).toContain('Summary:');
  });

  it('formats removed items', () => {
    const a = makeConfig();
    const b = makeConfig({ scenarios: [] });
    const report = compareConfigs(a, b);
    const text = formatComparisonReport(report);
    expect(text).toContain('Removed');
    expect(text).toContain('-');
  });

  it('formats modified items', () => {
    const a = makeConfig();
    const b = makeConfig({ project: { name: 'changed' } });
    const report = compareConfigs(a, b);
    const text = formatComparisonReport(report);
    expect(text).toContain('Modified');
    expect(text).toContain('~');
  });
});
