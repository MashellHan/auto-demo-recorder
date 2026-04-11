import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../src/config/schema.js';

describe('ConfigSchema', () => {
  const minimalConfig = {
    project: { name: 'test-project' },
    scenarios: [
      {
        name: 'basic',
        description: 'A basic scenario',
        steps: [{ action: 'type', value: 'hello' }],
      },
    ],
  };

  it('parses a minimal valid config', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.project.name).toBe('test-project');
    expect(result.scenarios.length).toBe(1);
    expect(result.scenarios[0].name).toBe('basic');
  });

  it('applies recording defaults', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.recording.width).toBe(1200);
    expect(result.recording.height).toBe(800);
    expect(result.recording.fps).toBe(25);
    expect(result.recording.format).toBe('mp4');
    expect(result.recording.backend).toBe('vhs');
    expect(result.recording.parallel).toBe(false);
    expect(result.recording.max_workers).toBe(3);
  });

  it('applies output defaults', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.output.dir).toBe('.demo-recordings');
    expect(result.output.keep_raw).toBe(true);
    expect(result.output.keep_frames).toBe(false);
    expect(result.output.record_mode).toBe('always');
  });

  it('applies annotation defaults', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.annotation.enabled).toBe(true);
    expect(result.annotation.model).toBe('claude-sonnet-4-6');
    expect(result.annotation.extract_fps).toBe(1);
    expect(result.annotation.language).toBe('en');
  });

  it('applies watch defaults', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.watch.include).toEqual(['src/**/*']);
    expect(result.watch.debounce_ms).toBe(500);
  });

  it('applies step defaults', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.scenarios[0].steps[0].pause).toBe('500ms');
  });

  it('rejects config without scenarios for vhs backend', () => {
    expect(() =>
      ConfigSchema.parse({
        project: { name: 'empty' },
        scenarios: [],
      }),
    ).toThrow();
  });

  it('rejects config without browser_scenarios for browser backend', () => {
    expect(() =>
      ConfigSchema.parse({
        project: { name: 'empty' },
        recording: { backend: 'browser' },
        browser_scenarios: [],
      }),
    ).toThrow();
  });

  it('accepts browser backend with browser_scenarios', () => {
    const result = ConfigSchema.parse({
      project: { name: 'web-app' },
      recording: { backend: 'browser' },
      browser_scenarios: [
        {
          name: 'login',
          description: 'Login flow',
          url: 'http://localhost:3000',
          steps: [{ action: 'click', value: '#login' }],
        },
      ],
    });
    expect(result.browser_scenarios.length).toBe(1);
    expect(result.browser_scenarios[0].url).toBe('http://localhost:3000');
  });

  it('validates step action enum', () => {
    expect(() =>
      ConfigSchema.parse({
        project: { name: 'bad' },
        scenarios: [
          {
            name: 'bad',
            description: 'bad',
            steps: [{ action: 'invalid_action', value: 'x' }],
          },
        ],
      }),
    ).toThrow();
  });

  it('validates browser step actions', () => {
    const result = ConfigSchema.parse({
      project: { name: 'browser-test' },
      recording: { backend: 'browser' },
      browser_scenarios: [
        {
          name: 'test',
          description: 'test',
          url: 'http://localhost:3000',
          steps: [
            { action: 'navigate', value: 'http://example.com' },
            { action: 'click', value: '#btn' },
            { action: 'fill', value: '#input', text: 'hello' },
            { action: 'scroll', value: '500' },
            { action: 'hover', value: '.menu' },
            { action: 'select', value: '#dropdown' },
          ],
        },
      ],
    });
    expect(result.browser_scenarios[0].steps.length).toBe(6);
  });

  it('applies scenario defaults (tags, setup, depends_on)', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.scenarios[0].tags).toEqual([]);
    expect(result.scenarios[0].setup).toEqual([]);
    expect(result.scenarios[0].depends_on).toEqual([]);
  });

  it('parses hooks', () => {
    const result = ConfigSchema.parse({
      project: { name: 'hooks' },
      scenarios: [
        {
          name: 'hooked',
          description: 'Has hooks',
          steps: [{ action: 'type', value: 'hi' }],
          hooks: { before: 'npm start', after: 'npm stop' },
        },
      ],
    });
    expect(result.scenarios[0].hooks?.before).toBe('npm start');
    expect(result.scenarios[0].hooks?.after).toBe('npm stop');
  });

  it('parses custom profiles', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      profiles: [
        { name: 'fast', description: 'Quick run', recording: { fps: 10 } },
      ],
    });
    expect(result.profiles.length).toBe(1);
    expect(result.profiles[0].name).toBe('fast');
  });

  it('parses rate limit config', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      rate_limit: { enabled: true, max_recordings: 5, window_seconds: 60 },
    });
    expect(result.rate_limit.enabled).toBe(true);
    expect(result.rate_limit.max_recordings).toBe(5);
  });

  it('parses rate limit preset', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      rate_limit: { enabled: true, preset: 'ci' },
    });
    expect(result.rate_limit.preset).toBe('ci');
  });

  it('validates recording format enum', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      recording: { format: 'gif' },
    });
    expect(result.recording.format).toBe('gif');
  });

  it('validates browser config defaults', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.recording.browser.headless).toBe(true);
    expect(result.recording.browser.browser).toBe('chromium');
    expect(result.recording.browser.viewport_width).toBe(1280);
  });

  it('validates frame config', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      recording: { frame: { style: 'colorful', title: 'My Terminal' } },
    });
    expect(result.recording.frame.style).toBe('colorful');
    expect(result.recording.frame.title).toBe('My Terminal');
  });

  it('rejects invalid max_workers', () => {
    expect(() =>
      ConfigSchema.parse({
        ...minimalConfig,
        recording: { max_workers: 0 },
      }),
    ).toThrow();

    expect(() =>
      ConfigSchema.parse({
        ...minimalConfig,
        recording: { max_workers: 17 },
      }),
    ).toThrow();
  });

  it('validates retain-on-failure mode', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      output: { record_mode: 'retain-on-failure' },
    });
    expect(result.output.record_mode).toBe('retain-on-failure');
  });

  it('supports step repeat', () => {
    const result = ConfigSchema.parse({
      project: { name: 'repeat-test' },
      scenarios: [
        {
          name: 'repeat',
          description: 'Repeat test',
          steps: [{ action: 'key', value: 'j', repeat: 5 }],
        },
      ],
    });
    expect(result.scenarios[0].steps[0].repeat).toBe(5);
  });

  it('supports multi-format output', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      recording: { formats: ['mp4', 'gif'] },
    });
    expect(result.recording.formats).toEqual(['mp4', 'gif']);
  });
});
