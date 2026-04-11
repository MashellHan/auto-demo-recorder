import { describe, it, expect } from 'vitest';
import { formatDryRun } from '../src/cli.js';

describe('formatDryRun', () => {
  const baseConfig = {
    recording: {
      format: 'mp4',
      theme: 'Catppuccin Mocha',
      backend: 'vhs',
    },
    output: { dir: '.demo-recordings' },
    annotation: { enabled: true, model: 'claude-sonnet-4-6' },
  };

  it('shows scenario plan for VHS backend', () => {
    const scenario = {
      name: 'basic-navigation',
      description: 'Navigate the app',
      steps: [
        { action: 'type', value: 'hello' },
        { action: 'type', value: 'world' },
        { action: 'key', value: 'Enter' },
        { action: 'sleep', value: '2s' },
        { action: 'sleep', value: '1s' },
      ],
    };

    const result = formatDryRun(scenario, baseConfig, 'vhs');

    expect(result).toContain('[DRY RUN]');
    expect(result).toContain('basic-navigation');
    expect(result).toContain('Backend: vhs');
    expect(result).toContain('Format: mp4');
    expect(result).toContain('Theme: Catppuccin Mocha');
    expect(result).toContain('Steps: 5');
    expect(result).toContain('type x2');
    expect(result).toContain('key x1');
    expect(result).toContain('sleep x2');
    expect(result).toContain('Annotation: enabled (claude-sonnet-4-6)');
  });

  it('shows URL for browser backend', () => {
    const scenario = {
      name: 'web-demo',
      description: 'Web demo',
      url: 'http://localhost:3000',
      steps: [
        { action: 'click', value: 'button' },
        { action: 'sleep', value: '1s' },
      ],
    };

    const result = formatDryRun(scenario, baseConfig, 'browser');

    expect(result).toContain('Backend: browser');
    expect(result).toContain('URL: http://localhost:3000');
    expect(result).toContain('click x1');
    expect(result).toContain('sleep x1');
  });

  it('shows hooks when configured', () => {
    const scenario = {
      name: 'with-hooks',
      description: 'With hooks',
      steps: [{ action: 'type', value: 'x' }],
      hooks: { before: 'npm run dev &', after: 'kill %1' },
    };

    const result = formatDryRun(scenario, baseConfig, 'vhs');

    expect(result).toContain('Hooks:');
    expect(result).toContain('before: "npm run dev &"');
    expect(result).toContain('after: "kill %1"');
  });

  it('omits hooks line when no hooks configured', () => {
    const scenario = {
      name: 'no-hooks',
      description: 'No hooks',
      steps: [{ action: 'type', value: 'x' }],
    };

    const result = formatDryRun(scenario, baseConfig, 'vhs');

    expect(result).not.toContain('Hooks:');
  });

  it('shows disabled annotation', () => {
    const config = {
      ...baseConfig,
      annotation: { enabled: false, model: 'claude-sonnet-4-6' },
    };

    const scenario = {
      name: 'no-annotate',
      description: 'No annotation',
      steps: [{ action: 'type', value: 'x' }],
    };

    const result = formatDryRun(scenario, config, 'vhs');

    expect(result).toContain('Annotation: disabled');
  });

  it('shows multi-format output', () => {
    const config = {
      ...baseConfig,
      recording: { ...baseConfig.recording, formats: ['mp4', 'gif', 'svg'] },
    };

    const scenario = {
      name: 'multi-format',
      description: 'Multi format',
      steps: [{ action: 'type', value: 'x' }],
    };

    const result = formatDryRun(scenario, config, 'vhs');

    expect(result).toContain('Format: mp4, gif, svg');
  });
});
