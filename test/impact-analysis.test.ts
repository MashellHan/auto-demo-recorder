import { describe, it, expect } from 'vitest';
import { analyzeImpact, analyzeFailureImpact, formatImpactAnalysis } from '../src/analytics/impact-analysis.js';
import type { ImpactScenario } from '../src/analytics/impact-analysis.js';

describe('analyzeImpact', () => {
  it('returns empty for no scenarios', () => {
    const result = analyzeImpact([]);
    expect(result.impacts).toEqual([]);
    expect(result.highestImpact).toBeNull();
    expect(result.totalScenarios).toBe(0);
  });

  it('handles independent scenarios (no dependencies)', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'a' },
      { name: 'b' },
    ];
    const result = analyzeImpact(scenarios);
    expect(result.impacts.length).toBe(2);
    expect(result.impacts[0].allAffected).toEqual([]);
    expect(result.highestImpact).toBeNull();
    expect(result.rootScenarios).toEqual(['a', 'b']);
    expect(result.leafScenarios).toEqual(['a', 'b']);
  });

  it('computes direct dependents', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'base' },
      { name: 'child', depends_on: ['base'] },
    ];
    const result = analyzeImpact(scenarios);
    const base = result.impacts.find((i) => i.scenario === 'base')!;
    expect(base.directDependents).toEqual(['child']);
    expect(base.allAffected).toEqual(['child']);
  });

  it('computes transitive impact', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['b'] },
    ];
    const result = analyzeImpact(scenarios);
    const a = result.impacts.find((i) => i.scenario === 'a')!;
    expect(a.allAffected).toContain('b');
    expect(a.allAffected).toContain('c');
    expect(a.impactDepth).toBe(2);
  });

  it('builds impact layers correctly', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'root' },
      { name: 'l1a', depends_on: ['root'] },
      { name: 'l1b', depends_on: ['root'] },
      { name: 'l2', depends_on: ['l1a'] },
    ];
    const result = analyzeImpact(scenarios);
    const root = result.impacts.find((i) => i.scenario === 'root')!;
    expect(root.layers.length).toBe(2);
    expect(root.layers[0].depth).toBe(1);
    expect(root.layers[0].scenarios).toContain('l1a');
    expect(root.layers[0].scenarios).toContain('l1b');
    expect(root.layers[1].depth).toBe(2);
    expect(root.layers[1].scenarios).toContain('l2');
  });

  it('sorts impacts by blast radius descending', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'small' },
      { name: 'big' },
      { name: 'child1', depends_on: ['big'] },
      { name: 'child2', depends_on: ['big'] },
      { name: 'child3', depends_on: ['small'] },
    ];
    const result = analyzeImpact(scenarios);
    expect(result.impacts[0].scenario).toBe('big');
    expect(result.impacts[0].allAffected.length).toBe(2);
  });

  it('identifies highest impact scenario', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'core' },
      { name: 'a', depends_on: ['core'] },
      { name: 'b', depends_on: ['core'] },
      { name: 'c', depends_on: ['core'] },
    ];
    const result = analyzeImpact(scenarios);
    expect(result.highestImpact?.scenario).toBe('core');
    expect(result.highestImpact?.allAffected.length).toBe(3);
  });

  it('identifies root scenarios', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'root1' },
      { name: 'root2' },
      { name: 'child', depends_on: ['root1'] },
    ];
    const result = analyzeImpact(scenarios);
    expect(result.rootScenarios).toContain('root1');
    expect(result.rootScenarios).toContain('root2');
    expect(result.rootScenarios).not.toContain('child');
  });

  it('identifies leaf scenarios', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'root' },
      { name: 'middle', depends_on: ['root'] },
      { name: 'leaf', depends_on: ['middle'] },
    ];
    const result = analyzeImpact(scenarios);
    expect(result.leafScenarios).toContain('leaf');
    expect(result.leafScenarios).not.toContain('root');
  });

  it('handles diamond dependencies', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'base' },
      { name: 'left', depends_on: ['base'] },
      { name: 'right', depends_on: ['base'] },
      { name: 'join', depends_on: ['left', 'right'] },
    ];
    const result = analyzeImpact(scenarios);
    const base = result.impacts.find((i) => i.scenario === 'base')!;
    expect(base.allAffected).toContain('left');
    expect(base.allAffected).toContain('right');
    expect(base.allAffected).toContain('join');
    // No duplicates
    const uniqueAffected = new Set(base.allAffected);
    expect(uniqueAffected.size).toBe(base.allAffected.length);
  });

  it('ignores dependencies on unknown scenarios', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'a', depends_on: ['nonexistent'] },
    ];
    const result = analyzeImpact(scenarios);
    expect(result.impacts.length).toBe(1);
    expect(result.impacts[0].allAffected).toEqual([]);
  });
});

describe('analyzeFailureImpact', () => {
  it('filters to only failing scenarios', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c' },
    ];
    const result = analyzeFailureImpact(scenarios, ['a']);
    expect(result.impacts.length).toBe(1);
    expect(result.impacts[0].scenario).toBe('a');
  });

  it('preserves total and leaf/root counts', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
    ];
    const result = analyzeFailureImpact(scenarios, ['a']);
    expect(result.totalScenarios).toBe(2);
    expect(result.rootScenarios).toContain('a');
  });
});

describe('formatImpactAnalysis', () => {
  it('formats empty result', () => {
    const result = analyzeImpact([]);
    const text = formatImpactAnalysis(result);
    expect(text).toContain('Dependency Impact Analysis');
    expect(text).toContain('No scenarios');
  });

  it('formats with no dependents', () => {
    const result = analyzeImpact([{ name: 'a' }, { name: 'b' }]);
    const text = formatImpactAnalysis(result);
    expect(text).toContain('No scenarios have downstream dependents');
  });

  it('formats with impact data', () => {
    const scenarios: ImpactScenario[] = [
      { name: 'core' },
      { name: 'feature', depends_on: ['core'] },
    ];
    const result = analyzeImpact(scenarios);
    const text = formatImpactAnalysis(result);
    expect(text).toContain('core');
    expect(text).toContain('feature');
    expect(text).toContain('Highest impact');
    expect(text).toContain('L1');
  });

  it('shows root and leaf counts', () => {
    const result = analyzeImpact([{ name: 'a' }]);
    const text = formatImpactAnalysis(result);
    expect(text).toContain('Root scenarios');
    expect(text).toContain('Leaf scenarios');
  });
});
