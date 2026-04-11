import { describe, it, expect } from 'vitest';
import { buildAdhocConfig, buildAdhocScenario } from '../src/config/adhoc.js';

describe('buildAdhocConfig', () => {
  it('creates config with defaults', () => {
    const config = buildAdhocConfig({ command: 'ls' });

    expect(config.project.name).toBe('adhoc-recording');
    expect(config.project.description).toContain('ls');
    expect(config.recording.width).toBe(1200);
    expect(config.recording.height).toBe(800);
    expect(config.recording.format).toBe('mp4');
    expect(config.annotation.enabled).toBe(true);
    expect(config.annotation.model).toBe('claude-sonnet-4-6');
    expect(config.output.dir).toBe('.demo-recordings');
  });

  it('accepts custom dimensions', () => {
    const config = buildAdhocConfig({ command: 'ls', width: 800, height: 600 });

    expect(config.recording.width).toBe(800);
    expect(config.recording.height).toBe(600);
  });

  it('accepts gif format', () => {
    const config = buildAdhocConfig({ command: 'ls', format: 'gif' });

    expect(config.recording.format).toBe('gif');
  });

  it('disables annotation when annotate=false', () => {
    const config = buildAdhocConfig({ command: 'ls', annotate: false });

    expect(config.annotation.enabled).toBe(false);
  });

  it('uses default theme when not specified', () => {
    const config = buildAdhocConfig({ command: 'ls' });

    expect(config.recording.theme).toBe('Catppuccin Mocha');
  });

  it('applies custom theme override', () => {
    const config = buildAdhocConfig({ command: 'ls', theme: 'Dracula' });

    expect(config.recording.theme).toBe('Dracula');
  });
});

describe('buildAdhocScenario', () => {
  it('creates scenario with command as first step', () => {
    const scenario = buildAdhocScenario('ls -la');

    expect(scenario.name).toBe('adhoc');
    expect(scenario.description).toContain('ls -la');
    expect(scenario.setup).toEqual([]);
    expect(scenario.steps).toHaveLength(1);
    expect(scenario.steps[0]).toEqual({ action: 'type', value: 'ls -la', pause: '2s' });
  });

  it('appends additional steps after command', () => {
    const steps = [
      { action: 'key' as const, value: 'j', pause: '500ms' },
      { action: 'key' as const, value: 'q', pause: '500ms' },
    ];
    const scenario = buildAdhocScenario('my-tui', steps);

    expect(scenario.steps).toHaveLength(3);
    expect(scenario.steps[0].action).toBe('type');
    expect(scenario.steps[0].value).toBe('my-tui');
    expect(scenario.steps[1]).toEqual({ action: 'key', value: 'j', pause: '500ms' });
    expect(scenario.steps[2]).toEqual({ action: 'key', value: 'q', pause: '500ms' });
  });

  it('handles undefined steps', () => {
    const scenario = buildAdhocScenario('echo hello', undefined);

    expect(scenario.steps).toHaveLength(1);
  });
});
