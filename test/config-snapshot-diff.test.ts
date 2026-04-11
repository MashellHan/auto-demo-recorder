import { describe, it, expect } from 'vitest';
import { createConfigSnapshot, detectDrift, classifyDriftSeverity, formatDrift } from '../src/config/config-snapshot-diff.js';
import type { Config } from '../src/config/schema.js';

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
      },
    ],
    browser_scenarios: [],
    ...overrides,
  } as Config;
}

describe('createConfigSnapshot', () => {
  it('creates snapshot with label and timestamp', () => {
    const config = makeConfig();
    const snapshot = createConfigSnapshot(config, 'v1.0');
    expect(snapshot.label).toBe('v1.0');
    expect(snapshot.timestamp).toBeDefined();
    expect(snapshot.config).toBe(config);
  });
});

describe('detectDrift', () => {
  it('detects no drift for identical configs', () => {
    const config = makeConfig();
    const snapshot = createConfigSnapshot(config, 'baseline');
    const result = detectDrift(snapshot, config);
    expect(result.hasDrift).toBe(false);
    expect(result.driftSummary).toBe('No drift detected');
  });

  it('detects drift when scenario added', () => {
    const original = makeConfig();
    const snapshot = createConfigSnapshot(original, 'baseline');
    const current = makeConfig({
      scenarios: [
        ...original.scenarios,
        { name: 'new-scenario', description: 'New', steps: [] },
      ],
    });
    const result = detectDrift(snapshot, current);
    expect(result.hasDrift).toBe(true);
    expect(result.driftSummary).toContain('added');
  });

  it('detects drift when scenario removed', () => {
    const original = makeConfig();
    const snapshot = createConfigSnapshot(original, 'baseline');
    const current = makeConfig({ scenarios: [] });
    const result = detectDrift(snapshot, current);
    expect(result.hasDrift).toBe(true);
    expect(result.driftSummary).toContain('removed');
  });

  it('detects drift when settings changed', () => {
    const original = makeConfig();
    const snapshot = createConfigSnapshot(original, 'baseline');
    const current = makeConfig({
      recording: { ...original.recording, fps: 60 },
    } as Partial<Config>);
    const result = detectDrift(snapshot, current);
    expect(result.hasDrift).toBe(true);
    expect(result.driftSummary).toContain('modified');
  });

  it('preserves snapshot metadata', () => {
    const snapshot = createConfigSnapshot(makeConfig(), 'test-label');
    const result = detectDrift(snapshot, makeConfig());
    expect(result.snapshot.label).toBe('test-label');
    expect(result.snapshot.timestamp).toBeDefined();
  });
});

describe('classifyDriftSeverity', () => {
  it('returns none for no changes', () => {
    expect(classifyDriftSeverity([])).toBe('none');
  });

  it('returns low for minor setting changes', () => {
    const changes = [
      { category: 'setting' as const, type: 'modified' as const, path: 'project.name', description: 'name changed' },
    ];
    expect(classifyDriftSeverity(changes)).toBe('low');
  });

  it('returns medium for scenario changes', () => {
    const changes = [
      { category: 'scenario' as const, type: 'added' as const, path: 'scenarios.new', description: 'new scenario', newValue: 'new' },
    ];
    expect(classifyDriftSeverity(changes)).toBe('medium');
  });

  it('returns high for scenario + recording changes', () => {
    const changes = [
      { category: 'scenario' as const, type: 'removed' as const, path: 'scenarios.old', description: 'removed', oldValue: 'old' },
      { category: 'recording' as const, type: 'modified' as const, path: 'recording.fps', description: 'fps changed' },
    ];
    expect(classifyDriftSeverity(changes)).toBe('high');
  });

  it('returns medium for many small changes', () => {
    const changes = Array.from({ length: 6 }, (_, i) => ({
      category: 'setting' as const,
      type: 'modified' as const,
      path: `setting.${i}`,
      description: `change ${i}`,
    }));
    expect(classifyDriftSeverity(changes)).toBe('medium');
  });
});

describe('formatDrift', () => {
  it('formats no-drift result', () => {
    const snapshot = createConfigSnapshot(makeConfig(), 'baseline');
    const result = detectDrift(snapshot, makeConfig());
    const text = formatDrift(result);
    expect(text).toContain('Config Drift Report');
    expect(text).toContain('No drift detected');
    expect(text).toContain('baseline');
  });

  it('formats drift result with changes', () => {
    const original = makeConfig();
    const snapshot = createConfigSnapshot(original, 'baseline');
    const current = makeConfig({
      scenarios: [
        ...original.scenarios,
        { name: 'new', description: 'New', steps: [] },
      ],
    });
    const result = detectDrift(snapshot, current);
    const text = formatDrift(result);
    expect(text).toContain('Drift detected');
    expect(text).toContain('Added');
    expect(text).toContain('+');
  });

  it('shows severity icon', () => {
    const original = makeConfig();
    const snapshot = createConfigSnapshot(original, 'baseline');
    const current = makeConfig({ project: { name: 'changed' } });
    const result = detectDrift(snapshot, current);
    const text = formatDrift(result);
    expect(text).toContain('🟢');
  });
});
