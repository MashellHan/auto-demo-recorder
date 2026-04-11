import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../src/config/schema.js';

describe('ConfigSchema', () => {
  it('parses a valid config', () => {
    const raw = {
      project: {
        name: 'test-project',
        description: 'A test project',
      },
      scenarios: [
        {
          name: 'basic',
          description: 'Basic test',
          steps: [{ action: 'type', value: 'hello', pause: '1s' }],
        },
      ],
    };

    const config = ConfigSchema.parse(raw);
    expect(config.project.name).toBe('test-project');
    expect(config.recording.width).toBe(1200);
    expect(config.recording.height).toBe(800);
    expect(config.output.dir).toBe('.demo-recordings');
    expect(config.annotation.enabled).toBe(true);
    expect(config.scenarios).toHaveLength(1);
  });

  it('applies defaults for optional fields', () => {
    const raw = {
      project: { name: 'minimal' },
      scenarios: [
        {
          name: 'test',
          description: 'Test',
          steps: [{ action: 'key', value: 'q' }],
        },
      ],
    };

    const config = ConfigSchema.parse(raw);
    expect(config.project.description).toBe('');
    expect(config.recording.font_size).toBe(16);
    expect(config.recording.theme).toBe('Catppuccin Mocha');
    expect(config.annotation.model).toBe('claude-sonnet-4-6');
    expect(config.output.keep_raw).toBe(true);
    expect(config.output.keep_frames).toBe(false);
  });

  it('rejects config without scenarios (vhs backend)', () => {
    const raw = {
      project: { name: 'no-scenarios' },
      scenarios: [],
    };

    expect(() => ConfigSchema.parse(raw)).toThrow();
  });

  it('rejects config without project name', () => {
    const raw = {
      project: {},
      scenarios: [
        {
          name: 'test',
          description: 'Test',
          steps: [{ action: 'key', value: 'q' }],
        },
      ],
    };

    expect(() => ConfigSchema.parse(raw)).toThrow();
  });

  it('validates step action enum', () => {
    const raw = {
      project: { name: 'bad-action' },
      scenarios: [
        {
          name: 'test',
          description: 'Test',
          steps: [{ action: 'invalid', value: 'x' }],
        },
      ],
    };

    expect(() => ConfigSchema.parse(raw)).toThrow();
  });

  it('parses setup commands', () => {
    const raw = {
      project: { name: 'with-setup' },
      scenarios: [
        {
          name: 'test',
          description: 'Test',
          setup: ['cmd1', 'cmd2'],
          steps: [{ action: 'key', value: 'q' }],
        },
      ],
    };

    const config = ConfigSchema.parse(raw);
    expect(config.scenarios[0].setup).toEqual(['cmd1', 'cmd2']);
  });

  it('defaults format to mp4', () => {
    const raw = {
      project: { name: 'test' },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.format).toBe('mp4');
  });

  it('accepts gif format', () => {
    const raw = {
      project: { name: 'test' },
      recording: { format: 'gif' },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.format).toBe('gif');
  });

  it('rejects invalid format', () => {
    const raw = {
      project: { name: 'test' },
      recording: { format: 'avi' },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    expect(() => ConfigSchema.parse(raw)).toThrow();
  });

  it('accepts screenshot action in terminal steps', () => {
    const raw = {
      project: { name: 'test' },
      scenarios: [
        {
          name: 'screenshot-test',
          description: 'Screenshot test',
          steps: [{ action: 'screenshot', value: 'snap.png' }],
        },
      ],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.scenarios[0].steps[0].action).toBe('screenshot');
  });

  it('defaults record_mode to always', () => {
    const raw = {
      project: { name: 'test' },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.output.record_mode).toBe('always');
  });

  it('accepts retain-on-failure record_mode', () => {
    const raw = {
      project: { name: 'test' },
      output: { record_mode: 'retain-on-failure' },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.output.record_mode).toBe('retain-on-failure');
  });

  it('accepts idle_time_limit in recording config', () => {
    const raw = {
      project: { name: 'test' },
      recording: { idle_time_limit: 3 },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.idle_time_limit).toBe(3);
  });

  it('defaults idle_time_limit to undefined', () => {
    const raw = {
      project: { name: 'test' },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.idle_time_limit).toBeUndefined();
  });

  it('accepts formats array in recording config', () => {
    const raw = {
      project: { name: 'test' },
      recording: { formats: ['mp4', 'gif'] },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.formats).toEqual(['mp4', 'gif']);
  });

  it('defaults formats to undefined', () => {
    const raw = {
      project: { name: 'test' },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.formats).toBeUndefined();
  });
});

describe('ConfigSchema — browser backend', () => {
  it('defaults backend to vhs', () => {
    const raw = {
      project: { name: 'test' },
      scenarios: [{ name: 'test', description: 'Test', steps: [{ action: 'key', value: 'q' }] }],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.backend).toBe('vhs');
  });

  it('accepts browser backend with browser_scenarios', () => {
    const raw = {
      project: { name: 'web-app' },
      recording: { backend: 'browser' },
      browser_scenarios: [
        {
          name: 'homepage',
          description: 'Homepage test',
          url: 'http://localhost:3000',
          steps: [
            { action: 'click', value: 'button.login', pause: '1s' },
          ],
        },
      ],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.backend).toBe('browser');
    expect(config.browser_scenarios).toHaveLength(1);
    expect(config.browser_scenarios[0].url).toBe('http://localhost:3000');
  });

  it('rejects browser backend without browser_scenarios', () => {
    const raw = {
      project: { name: 'web-app' },
      recording: { backend: 'browser' },
      browser_scenarios: [],
    };
    expect(() => ConfigSchema.parse(raw)).toThrow();
  });

  it('applies browser config defaults', () => {
    const raw = {
      project: { name: 'web-app' },
      recording: { backend: 'browser' },
      browser_scenarios: [
        {
          name: 'test',
          description: 'Test',
          url: 'http://localhost:3000',
          steps: [{ action: 'sleep', value: '1s' }],
        },
      ],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.browser.headless).toBe(true);
    expect(config.recording.browser.browser).toBe('chromium');
    expect(config.recording.browser.viewport_width).toBe(1280);
    expect(config.recording.browser.viewport_height).toBe(720);
    expect(config.recording.browser.timeout_ms).toBe(30_000);
    expect(config.recording.browser.device_scale_factor).toBe(1);
    expect(config.recording.browser.record_video).toBe(true);
  });

  it('validates browser step actions', () => {
    const raw = {
      project: { name: 'web-app' },
      recording: { backend: 'browser' },
      browser_scenarios: [
        {
          name: 'test',
          description: 'Test',
          url: 'http://localhost:3000',
          steps: [{ action: 'invalid_action', value: 'x' }],
        },
      ],
    };
    expect(() => ConfigSchema.parse(raw)).toThrow();
  });

  it('parses all browser step actions', () => {
    const raw = {
      project: { name: 'web-app' },
      recording: { backend: 'browser' },
      browser_scenarios: [
        {
          name: 'full-test',
          description: 'All step types',
          url: 'http://localhost:3000',
          steps: [
            { action: 'navigate', value: 'http://localhost:3000/page' },
            { action: 'click', value: '#btn' },
            { action: 'fill', value: '#input', text: 'hello' },
            { action: 'type', value: 'typed text' },
            { action: 'key', value: 'Enter' },
            { action: 'sleep', value: '1s' },
            { action: 'scroll', value: '300' },
            { action: 'hover', value: '.menu-item' },
            { action: 'select', value: '#dropdown', text: 'option1' },
            { action: 'screenshot', value: 'test.png' },
            { action: 'wait', value: '.loaded' },
          ],
        },
      ],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.browser_scenarios[0].steps).toHaveLength(11);
  });

  it('accepts browser_scenarios with repeat field', () => {
    const raw = {
      project: { name: 'web-app' },
      recording: { backend: 'browser' },
      browser_scenarios: [
        {
          name: 'repeat-test',
          description: 'Test with repeat',
          url: 'http://localhost:3000',
          steps: [
            { action: 'key', value: 'Tab', repeat: 3 },
          ],
        },
      ],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.browser_scenarios[0].steps[0].repeat).toBe(3);
  });

  it('rejects invalid browser URL', () => {
    const raw = {
      project: { name: 'web-app' },
      recording: { backend: 'browser' },
      browser_scenarios: [
        {
          name: 'bad-url',
          description: 'Bad URL',
          url: 'not-a-url',
          steps: [{ action: 'sleep', value: '1s' }],
        },
      ],
    };
    expect(() => ConfigSchema.parse(raw)).toThrow();
  });

  it('accepts custom browser config overrides', () => {
    const raw = {
      project: { name: 'web-app' },
      recording: {
        backend: 'browser',
        browser: {
          headless: false,
          browser: 'firefox',
          viewport_width: 1920,
          viewport_height: 1080,
          timeout_ms: 60000,
          device_scale_factor: 2,
          record_video: false,
        },
      },
      browser_scenarios: [
        {
          name: 'custom',
          description: 'Custom browser',
          url: 'http://localhost:3000',
          steps: [{ action: 'sleep', value: '1s' }],
        },
      ],
    };
    const config = ConfigSchema.parse(raw);
    expect(config.recording.browser.headless).toBe(false);
    expect(config.recording.browser.browser).toBe('firefox');
    expect(config.recording.browser.viewport_width).toBe(1920);
    expect(config.recording.browser.device_scale_factor).toBe(2);
    expect(config.recording.browser.record_video).toBe(false);
  });
});
