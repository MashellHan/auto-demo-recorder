import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/cli.js';

describe('validateConfig', () => {
  const baseConfig = {
    project: { name: 'test-project', description: 'My test project' },
    recording: { width: 1200, height: 800, backend: 'vhs', theme: 'Catppuccin Mocha', format: 'mp4' },
    output: { dir: '.demo-recordings' },
    annotation: { enabled: true, model: 'claude-sonnet-4-6' },
    scenarios: [
      { name: 'basic', description: 'Basic', steps: [], tags: ['smoke'] },
    ],
    browser_scenarios: [],
  };

  it('shows project info and scenario counts', () => {
    const result = validateConfig(baseConfig);

    expect(result).toContain('✓ Config valid');
    expect(result).toContain('Project: test-project');
    expect(result).toContain('Description: My test project');
    expect(result).toContain('Terminal Scenarios: 1');
    expect(result).toContain('Browser Scenarios: 0');
  });

  it('shows recording settings', () => {
    const result = validateConfig(baseConfig);

    expect(result).toContain('Recording: 1200x800 (vhs)');
    expect(result).toContain('Theme: Catppuccin Mocha');
    expect(result).toContain('Format: mp4');
  });

  it('shows annotation status', () => {
    const result = validateConfig(baseConfig);
    expect(result).toContain('Annotation: enabled (claude-sonnet-4-6)');
  });

  it('shows disabled annotation', () => {
    const config = {
      ...baseConfig,
      annotation: { enabled: false, model: 'claude-sonnet-4-6' },
    };
    const result = validateConfig(config);
    expect(result).toContain('Annotation: disabled');
  });

  it('warns about untagged scenarios', () => {
    const config = {
      ...baseConfig,
      scenarios: [
        { name: 'tagged', description: 'Has tags', steps: [], tags: ['smoke'] },
        { name: 'untagged', description: 'No tags', steps: [], tags: [] },
      ],
    };

    const result = validateConfig(config);

    expect(result).toContain('Warnings:');
    expect(result).toContain('Scenario "untagged" has no tags');
    expect(result).not.toContain('Scenario "tagged" has no tags');
  });

  it('warns about missing idle_time_limit', () => {
    const result = validateConfig(baseConfig);
    expect(result).toContain('idle_time_limit not set');
  });

  it('does not warn when idle_time_limit is set', () => {
    const config = {
      ...baseConfig,
      recording: { ...baseConfig.recording, idle_time_limit: 5 },
    };

    const result = validateConfig(config);
    expect(result).not.toContain('idle_time_limit');
  });

  it('shows hooks summary when scenarios have hooks', () => {
    const config = {
      ...baseConfig,
      scenarios: [
        { name: 'with-hooks', description: 'Has hooks', steps: [], tags: ['smoke'], hooks: { before: 'npm run dev' } },
        { name: 'no-hooks', description: 'No hooks', steps: [], tags: ['smoke'] },
      ],
    };

    const result = validateConfig(config);
    expect(result).toContain('Hooks: 1 scenario(s) with lifecycle hooks');
  });

  it('shows browser config when backend is browser', () => {
    const config = {
      ...baseConfig,
      recording: {
        ...baseConfig.recording,
        backend: 'browser',
        browser: { browser: 'firefox', viewport_width: 1920, viewport_height: 1080 },
      },
    };

    const result = validateConfig(config);
    expect(result).toContain('Browser: firefox, viewport 1920x1080');
  });

  it('no warnings section when all checks pass', () => {
    const config = {
      ...baseConfig,
      recording: { ...baseConfig.recording, idle_time_limit: 5 },
    };

    const result = validateConfig(config);
    expect(result).not.toContain('Warnings:');
  });

  it('warns about circular dependencies', () => {
    const config = {
      ...baseConfig,
      scenarios: [
        { name: 'a', description: 'A', steps: [], tags: ['smoke'], depends_on: ['b'] },
        { name: 'b', description: 'B', steps: [], tags: ['smoke'], depends_on: ['a'] },
      ],
    };

    const result = validateConfig(config);
    expect(result).toContain('Warnings:');
    expect(result).toMatch(/[Cc]ircular|[Cc]ycle/);
  });

  it('warns about missing dependency references', () => {
    const config = {
      ...baseConfig,
      scenarios: [
        { name: 'a', description: 'A', steps: [], tags: ['smoke'], depends_on: ['nonexistent'] },
      ],
    };

    const result = validateConfig(config);
    expect(result).toContain('Warnings:');
    expect(result).toContain('nonexistent');
  });

  it('no dependency warnings for valid depends_on chains', () => {
    const config = {
      ...baseConfig,
      recording: { ...baseConfig.recording, idle_time_limit: 5 },
      scenarios: [
        { name: 'setup', description: 'Setup', steps: [], tags: ['smoke'], depends_on: [] },
        { name: 'test', description: 'Test', steps: [], tags: ['smoke'], depends_on: ['setup'] },
      ],
    };

    const result = validateConfig(config);
    expect(result).not.toContain('Warnings:');
  });
});
