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

  it('rejects config without scenarios', () => {
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
});
