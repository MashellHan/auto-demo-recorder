import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, findScenario, deepMerge } from '../src/config/loader.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `demo-recorder-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  it('loads and validates a config file', async () => {
    const configPath = join(tempDir, 'demo-recorder.yaml');
    await writeFile(
      configPath,
      `
project:
  name: test-project
  description: "Test"
scenarios:
  - name: basic
    description: "Basic"
    steps:
      - { action: "type", value: "hello", pause: "1s" }
`,
    );

    const config = await loadConfig(configPath);
    expect(config.project.name).toBe('test-project');
    expect(config.scenarios).toHaveLength(1);
    expect(config.recording.width).toBe(1200); // default
  });

  it('throws on invalid YAML', async () => {
    const configPath = join(tempDir, 'bad.yaml');
    await writeFile(configPath, 'not: [valid: yaml: !!');

    await expect(loadConfig(configPath)).rejects.toThrow();
  });

  it('throws on missing file', async () => {
    await expect(loadConfig('/nonexistent/path.yaml')).rejects.toThrow();
  });

  it('throws on invalid schema', async () => {
    const configPath = join(tempDir, 'invalid.yaml');
    await writeFile(configPath, 'project:\n  name: test\nscenarios: []');

    await expect(loadConfig(configPath)).rejects.toThrow();
  });
});

describe('findScenario', () => {
  const config = {
    project: { name: 'test', description: '' },
    recording: { width: 1200, height: 800, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60 },
    output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
    annotation: { enabled: true, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom' as const, overlay_font_size: 14 },
    scenarios: [
      { name: 'alpha', description: 'Alpha', setup: [], steps: [{ action: 'key' as const, value: 'q', pause: '500ms' }] },
      { name: 'beta', description: 'Beta', setup: [], steps: [{ action: 'key' as const, value: 'q', pause: '500ms' }] },
    ],
  };

  it('finds an existing scenario', () => {
    const s = findScenario(config, 'alpha');
    expect(s.name).toBe('alpha');
  });

  it('throws on missing scenario', () => {
    expect(() => findScenario(config, 'nonexistent')).toThrow('Scenario "nonexistent" not found');
  });

  it('includes available scenarios in error', () => {
    expect(() => findScenario(config, 'x')).toThrow('alpha, beta');
  });
});

describe('deepMerge', () => {
  it('merges nested objects', () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const override = { b: { c: 10 } };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: 1, b: { c: 10, d: 3 } });
  });

  it('replaces arrays', () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [4, 5] };
    const result = deepMerge(base, override);
    expect(result).toEqual({ items: [4, 5] });
  });

  it('adds new keys from override', () => {
    const base = { a: 1 };
    const override = { b: 2 };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('handles null values', () => {
    const base = { a: { b: 1 }, c: 'hello' };
    const override = { a: null };
    const result = deepMerge(base, override);
    expect(result.a).toBeNull();
  });
});

describe('loadConfig with extends', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `demo-recorder-extends-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  it('inherits from base config', async () => {
    // Base config with recording settings
    await writeFile(
      join(tempDir, 'base.yaml'),
      `
project:
  name: base-project
recording:
  width: 1920
  height: 1080
  theme: "Dracula"
scenarios:
  - name: base-scenario
    description: "From base"
    steps:
      - { action: "type", value: "hello" }
`,
    );

    // Child config extends base, overrides project name
    await writeFile(
      join(tempDir, 'child.yaml'),
      `
extends: "./base.yaml"
project:
  name: child-project
  description: "Overridden"
scenarios:
  - name: child-scenario
    description: "From child"
    steps:
      - { action: "type", value: "world" }
`,
    );

    const config = await loadConfig(join(tempDir, 'child.yaml'));

    // Project should be child's override
    expect(config.project.name).toBe('child-project');
    expect(config.project.description).toBe('Overridden');
    // Recording should come from base (merged)
    expect(config.recording.width).toBe(1920);
    expect(config.recording.height).toBe(1080);
    expect(config.recording.theme).toBe('Dracula');
    // Scenarios should be child's (arrays replace)
    expect(config.scenarios).toHaveLength(1);
    expect(config.scenarios[0].name).toBe('child-scenario');
  });

  it('child overrides specific recording fields from base', async () => {
    await writeFile(
      join(tempDir, 'base.yaml'),
      `
project:
  name: base
recording:
  width: 1920
  height: 1080
  theme: "Dracula"
  fps: 30
scenarios:
  - name: test
    description: "Test"
    steps:
      - { action: "type", value: "x" }
`,
    );

    await writeFile(
      join(tempDir, 'child.yaml'),
      `
extends: "./base.yaml"
project:
  name: child
recording:
  theme: "Catppuccin Mocha"
scenarios:
  - name: test
    description: "Test"
    steps:
      - { action: "type", value: "x" }
`,
    );

    const config = await loadConfig(join(tempDir, 'child.yaml'));

    // Theme overridden, but width/height/fps inherited
    expect(config.recording.theme).toBe('Catppuccin Mocha');
    expect(config.recording.width).toBe(1920);
    expect(config.recording.height).toBe(1080);
    expect(config.recording.fps).toBe(30);
  });

  it('throws when base config file is missing', async () => {
    await writeFile(
      join(tempDir, 'child.yaml'),
      `
extends: "./nonexistent-base.yaml"
project:
  name: child
scenarios:
  - name: test
    description: "Test"
    steps:
      - { action: "type", value: "x" }
`,
    );

    await expect(loadConfig(join(tempDir, 'child.yaml'))).rejects.toThrow();
  });

  it('works without extends field', async () => {
    await writeFile(
      join(tempDir, 'simple.yaml'),
      `
project:
  name: simple
scenarios:
  - name: test
    description: "Test"
    steps:
      - { action: "type", value: "x" }
`,
    );

    const config = await loadConfig(join(tempDir, 'simple.yaml'));
    expect(config.project.name).toBe('simple');
    expect(config.recording.width).toBe(1200); // default
  });
});
