import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, findScenario } from '../src/config/loader.js';
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
