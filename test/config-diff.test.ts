import { describe, it, expect } from 'vitest';
import {
  diffConfigs,
  formatConfigDiff,
} from '../src/config/config-diff.js';

describe('diffConfigs', () => {
  it('detects identical configs', () => {
    const config = { project: { name: 'test' }, recording: { format: 'mp4' } };
    const result = diffConfigs(config, { ...config });
    expect(result.identical).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  it('detects added fields', () => {
    const oldConfig = { project: { name: 'test' } };
    const newConfig = { project: { name: 'test' }, output: { dir: 'recordings' } };
    const result = diffConfigs(oldConfig, newConfig);
    expect(result.added).toBe(1);
    expect(result.differences[0].path).toBe('output');
    expect(result.differences[0].type).toBe('added');
  });

  it('detects removed fields', () => {
    const oldConfig = { project: { name: 'test' }, debug: true };
    const newConfig = { project: { name: 'test' } };
    const result = diffConfigs(oldConfig, newConfig);
    expect(result.removed).toBe(1);
    expect(result.differences[0].path).toBe('debug');
    expect(result.differences[0].type).toBe('removed');
  });

  it('detects changed values', () => {
    const oldConfig = { recording: { format: 'mp4' } };
    const newConfig = { recording: { format: 'gif' } };
    const result = diffConfigs(oldConfig, newConfig);
    expect(result.changed).toBe(1);
    expect(result.differences[0].path).toBe('recording.format');
    expect(result.differences[0].oldValue).toBe('mp4');
    expect(result.differences[0].newValue).toBe('gif');
  });

  it('handles nested object diffs recursively', () => {
    const oldConfig = {
      project: { name: 'old', description: 'original' },
      recording: { format: 'mp4', fps: 30 },
    };
    const newConfig = {
      project: { name: 'new', description: 'original' },
      recording: { format: 'mp4', fps: 60 },
    };
    const result = diffConfigs(oldConfig, newConfig);
    expect(result.changed).toBe(2);
    const paths = result.differences.map((d) => d.path);
    expect(paths).toContain('project.name');
    expect(paths).toContain('recording.fps');
  });

  it('detects array changes', () => {
    const oldConfig = { tags: ['demo', 'test'] };
    const newConfig = { tags: ['demo', 'production'] };
    const result = diffConfigs(oldConfig, newConfig);
    expect(result.changed).toBe(1);
    expect(result.differences[0].path).toBe('tags');
  });

  it('handles mixed additions, removals, and changes', () => {
    const oldConfig = { a: 1, b: 2, c: 3 };
    const newConfig = { a: 10, c: 3, d: 4 };
    const result = diffConfigs(oldConfig, newConfig);
    expect(result.added).toBe(1);    // d
    expect(result.removed).toBe(1);  // b
    expect(result.changed).toBe(1);  // a
  });

  it('handles deeply nested structures', () => {
    const oldConfig = { a: { b: { c: { d: 'old' } } } };
    const newConfig = { a: { b: { c: { d: 'new' } } } };
    const result = diffConfigs(oldConfig, newConfig);
    expect(result.differences).toHaveLength(1);
    expect(result.differences[0].path).toBe('a.b.c.d');
  });

  it('handles null values', () => {
    const oldConfig = { key: null } as Record<string, unknown>;
    const newConfig = { key: 'value' };
    const result = diffConfigs(oldConfig, newConfig);
    expect(result.changed).toBe(1);
  });

  it('handles empty objects', () => {
    const result = diffConfigs({}, {});
    expect(result.identical).toBe(true);
  });
});

describe('formatConfigDiff', () => {
  it('formats identical configs', () => {
    const result = diffConfigs({ a: 1 }, { a: 1 });
    expect(formatConfigDiff(result)).toBe('Configs are identical.');
  });

  it('formats additions', () => {
    const result = diffConfigs({}, { name: 'test' });
    const text = formatConfigDiff(result);
    expect(text).toContain('[ADDED]');
    expect(text).toContain('name');
    expect(text).toContain('"test"');
  });

  it('formats removals', () => {
    const result = diffConfigs({ name: 'test' }, {});
    const text = formatConfigDiff(result);
    expect(text).toContain('[REMOVED]');
    expect(text).toContain('name');
  });

  it('formats changes with old and new values', () => {
    const result = diffConfigs({ format: 'mp4' }, { format: 'gif' });
    const text = formatConfigDiff(result);
    expect(text).toContain('[CHANGED]');
    expect(text).toContain('Old: "mp4"');
    expect(text).toContain('New: "gif"');
  });

  it('formats summary line', () => {
    const result = diffConfigs({ a: 1, b: 2 }, { a: 10, c: 3 });
    const text = formatConfigDiff(result);
    expect(text).toContain('1 added, 1 removed, 1 changed');
  });

  it('formats large arrays as item count', () => {
    const result = diffConfigs({}, { items: [1, 2, 3, 4, 5] });
    const text = formatConfigDiff(result);
    expect(text).toContain('[5 items]');
  });

  it('formats large objects as field count', () => {
    const result = diffConfigs({}, { cfg: { a: 1, b: 2, c: 3, d: 4 } });
    const text = formatConfigDiff(result);
    expect(text).toContain('{4 fields}');
  });
});
