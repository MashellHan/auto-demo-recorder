import { describe, it, expect } from 'vitest';
import { filterByTag } from '../src/cli.js';

describe('filterByTag', () => {
  const scenarios = [
    { name: 'basic', tags: ['smoke', 'navigation'] },
    { name: 'advanced', tags: ['full', 'search'] },
    { name: 'regression', tags: ['smoke', 'regression'] },
    { name: 'no-tags', tags: [] },
  ];

  it('filters scenarios by include tag', () => {
    const result = filterByTag(scenarios, 'smoke');
    expect(result.map((s) => s.name)).toEqual(['basic', 'regression']);
  });

  it('filters scenarios by exclude tag with "!" prefix', () => {
    const result = filterByTag(scenarios, '!smoke');
    expect(result.map((s) => s.name)).toEqual(['advanced', 'no-tags']);
  });

  it('is case-insensitive', () => {
    const result = filterByTag(scenarios, 'SMOKE');
    expect(result.map((s) => s.name)).toEqual(['basic', 'regression']);
  });

  it('returns empty array when no scenarios match', () => {
    const result = filterByTag(scenarios, 'nonexistent');
    expect(result).toEqual([]);
  });

  it('returns all scenarios when exclude tag matches none', () => {
    const result = filterByTag(scenarios, '!nonexistent');
    expect(result.map((s) => s.name)).toEqual(['basic', 'advanced', 'regression', 'no-tags']);
  });

  it('handles scenarios without tags field', () => {
    const noTagScenarios = [
      { name: 'a' },
      { name: 'b', tags: ['test'] },
    ];
    const result = filterByTag(noTagScenarios, 'test');
    expect(result.map((s) => s.name)).toEqual(['b']);
  });

  it('excludes untagged scenarios when include tag used', () => {
    const result = filterByTag(scenarios, 'full');
    expect(result.map((s) => s.name)).toEqual(['advanced']);
  });

  it('keeps untagged scenarios when exclude tag used', () => {
    const result = filterByTag(scenarios, '!full');
    expect(result.map((s) => s.name)).toEqual(['basic', 'regression', 'no-tags']);
  });
});
