import { describe, it, expect } from 'vitest';
import { deepMerge, findScenario } from '../src/config/loader.js';
import type { Config } from '../src/config/schema.js';

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const base = { a: 1, b: 2 };
    const override = { b: 3, c: 4 };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('merges nested objects', () => {
    const base = { a: { x: 1, y: 2 }, b: 'base' };
    const override = { a: { y: 3, z: 4 } };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 'base' });
  });

  it('replaces arrays (does not concatenate)', () => {
    const base = { tags: ['a', 'b'] };
    const override = { tags: ['c'] };
    const result = deepMerge(base, override);
    expect(result).toEqual({ tags: ['c'] });
  });

  it('does not mutate the original objects', () => {
    const base = { a: { x: 1 }, b: 2 };
    const override = { a: { x: 99 } };
    const baseCopy = JSON.parse(JSON.stringify(base));
    deepMerge(base, override);
    expect(base).toEqual(baseCopy);
  });

  it('handles empty override', () => {
    const base = { a: 1, b: 2 };
    const result = deepMerge(base, {});
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('handles override with null values', () => {
    const base = { a: 1, b: { x: 2 } };
    const override = { b: null };
    const result = deepMerge(base, override as Record<string, unknown>);
    expect(result.b).toBeNull();
  });

  it('deeply merges 3+ levels', () => {
    const base = { a: { b: { c: 1, d: 2 } } };
    const override = { a: { b: { c: 99 } } };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: { b: { c: 99, d: 2 } } });
  });
});

describe('findScenario', () => {
  const mockConfig = {
    project: { name: 'test', description: '' },
    recording: { width: 1200, height: 800, fps: 25, font_size: 16, theme: 'Catppuccin Mocha', max_duration: 60, format: 'mp4', backend: 'vhs', parallel: false, max_workers: 3, browser: { headless: true, browser: 'chromium', viewport_width: 1280, viewport_height: 720, timeout_ms: 30000, device_scale_factor: 1, record_video: true }, frame: { style: 'none' } },
    output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false, record_mode: 'always' },
    annotation: { enabled: true, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
    watch: { include: ['src/**/*'], exclude: [], debounce_ms: 500 },
    scenarios: [
      { name: 'basic', description: 'Basic test', setup: [], steps: [{ action: 'type', value: 'hello', pause: '500ms' }], tags: [], depends_on: [] },
      { name: 'advanced', description: 'Advanced test', setup: [], steps: [{ action: 'type', value: 'world', pause: '500ms' }], tags: [], depends_on: [] },
    ],
    browser_scenarios: [],
    profiles: [],
    rate_limit: { enabled: false, max_recordings: 10, window_seconds: 300 },
  } as unknown as Config;

  it('finds a scenario by name', () => {
    const s = findScenario(mockConfig, 'basic');
    expect(s.name).toBe('basic');
  });

  it('throws for unknown scenario', () => {
    expect(() => findScenario(mockConfig, 'nonexistent')).toThrow('Scenario "nonexistent" not found');
  });

  it('includes available scenarios in error message', () => {
    expect(() => findScenario(mockConfig, 'missing')).toThrow('Available: basic, advanced');
  });
});
