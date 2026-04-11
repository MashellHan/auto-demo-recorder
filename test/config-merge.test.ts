import { describe, it, expect } from 'vitest';
import { mergeConfigs, formatMergeReport } from '../src/config/config-merge.js';

describe('mergeConfigs', () => {
  it('returns base when override is empty', () => {
    const base = { project: { name: 'test' }, width: 800 };
    const result = mergeConfigs(base, {});
    expect(result.merged).toEqual({ project: { name: 'test' }, width: 800 });
    expect(result.baseOnlyCount).toBeGreaterThan(0);
  });

  it('returns override when base is empty', () => {
    const override = { project: { name: 'override' } };
    const result = mergeConfigs({}, override);
    expect(result.merged).toEqual({ project: { name: 'override' } });
    expect(result.overrideCount).toBeGreaterThan(0);
  });

  it('overrides scalar values', () => {
    const base = { width: 800, height: 600 };
    const override = { width: 1920 };
    const result = mergeConfigs(base, override);
    expect(result.merged).toEqual({ width: 1920, height: 600 });
  });

  it('deep-merges nested objects', () => {
    const base = { recording: { width: 800, fps: 30, theme: 'Dracula' } };
    const override = { recording: { width: 1920 } };
    const result = mergeConfigs(base, override);
    expect((result.merged as any).recording.width).toBe(1920);
    expect((result.merged as any).recording.fps).toBe(30);
    expect((result.merged as any).recording.theme).toBe('Dracula');
  });

  it('replaces arrays (no concatenation)', () => {
    const base = { scenarios: [{ name: 'a' }, { name: 'b' }] };
    const override = { scenarios: [{ name: 'c' }] };
    const result = mergeConfigs(base, override);
    expect((result.merged as any).scenarios).toEqual([{ name: 'c' }]);
  });

  it('preserves base when override value is null', () => {
    const base = { theme: 'Dracula' };
    const override = { theme: null };
    const result = mergeConfigs(base, override as any);
    expect((result.merged as any).theme).toBe('Dracula');
  });

  it('preserves base when override value is undefined', () => {
    const base = { theme: 'Dracula' };
    const override = { theme: undefined };
    const result = mergeConfigs(base, override as any);
    expect((result.merged as any).theme).toBe('Dracula');
  });

  it('adds new keys from override', () => {
    const base = { project: { name: 'test' } };
    const override = { project: { name: 'test', version: '1.0' } };
    const result = mergeConfigs(base, override);
    expect((result.merged as any).project.version).toBe('1.0');
  });

  it('tracks resolutions correctly', () => {
    const base = { a: 1, b: { x: 2, y: 3 } };
    const override = { b: { x: 10 }, c: 99 };
    const result = mergeConfigs(base, override);
    expect(result.mergedCount).toBeGreaterThan(0);
    expect(result.overrideCount).toBeGreaterThan(0);
    expect(result.baseOnlyCount).toBeGreaterThan(0);
  });

  it('handles deeply nested merges', () => {
    const base = { a: { b: { c: { d: 1 } } } };
    const override = { a: { b: { c: { e: 2 } } } };
    const result = mergeConfigs(base, override);
    expect((result.merged as any).a.b.c.d).toBe(1);
    expect((result.merged as any).a.b.c.e).toBe(2);
  });

  it('overrides boolean values', () => {
    const base = { annotation: { enabled: true } };
    const override = { annotation: { enabled: false } };
    const result = mergeConfigs(base, override);
    expect((result.merged as any).annotation.enabled).toBe(false);
  });
});

describe('formatMergeReport', () => {
  it('formats a merge report', () => {
    const base = { a: 1, b: { x: 2 } };
    const override = { b: { x: 10 }, c: 99 };
    const result = mergeConfigs(base, override);
    const text = formatMergeReport(result);
    expect(text).toContain('Config Merge Report');
    expect(text).toContain('Summary:');
  });

  it('shows base-only keys', () => {
    const result = mergeConfigs({ only: 'base' }, {});
    const text = formatMergeReport(result);
    expect(text).toContain('Base-only');
    expect(text).toContain('only');
  });

  it('shows overridden keys', () => {
    const result = mergeConfigs({}, { only: 'override' });
    const text = formatMergeReport(result);
    expect(text).toContain('Overridden');
  });

  it('shows recursively merged keys', () => {
    const result = mergeConfigs({ a: { b: 1 } }, { a: { c: 2 } });
    const text = formatMergeReport(result);
    expect(text).toContain('Recursively merged');
  });
});
