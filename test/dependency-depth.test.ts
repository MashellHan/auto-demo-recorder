import { describe, it, expect } from 'vitest';
import { analyzeDependencyDepth, formatDepthAnalysis } from '../src/config/dependency-depth.js';

describe('analyzeDependencyDepth', () => {
  it('handles scenarios with no dependencies', () => {
    const scenarios = [
      { name: 'a' },
      { name: 'b' },
    ];
    const result = analyzeDependencyDepth(scenarios);
    expect(result.maxDepth).toBe(0);
    expect(result.roots.length).toBe(2);
    expect(result.scenarios.every((s) => s.depth === 0)).toBe(true);
  });

  it('computes depth for linear chain', () => {
    const scenarios = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['b'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    expect(result.maxDepth).toBe(2);
    const cInfo = result.scenarios.find((s) => s.name === 'c');
    expect(cInfo?.depth).toBe(2);
    expect(cInfo?.allDeps).toEqual(['a', 'b']);
  });

  it('identifies root and leaf nodes', () => {
    const scenarios = [
      { name: 'root' },
      { name: 'mid', depends_on: ['root'] },
      { name: 'leaf', depends_on: ['mid'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    expect(result.roots).toEqual(['root']);
    expect(result.leaves).toEqual(['leaf']);
  });

  it('computes direct dependents', () => {
    const scenarios = [
      { name: 'base' },
      { name: 'a', depends_on: ['base'] },
      { name: 'b', depends_on: ['base'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    const base = result.scenarios.find((s) => s.name === 'base');
    expect(base?.directDependents).toEqual(['a', 'b']);
  });

  it('detects unreachable scenarios', () => {
    const scenarios = [
      { name: 'a', depends_on: ['nonexistent'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    expect(result.unreachable).toEqual(['a']);
    const aInfo = result.scenarios.find((s) => s.name === 'a');
    expect(aInfo?.reachable).toBe(false);
    expect(aInfo?.missingDeps).toEqual(['nonexistent']);
  });

  it('builds critical path', () => {
    const scenarios = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['b'] },
      { name: 'd' },
    ];
    const result = analyzeDependencyDepth(scenarios);
    expect(result.criticalPath).toEqual(['a', 'b', 'c']);
  });

  it('handles diamond dependencies', () => {
    const scenarios = [
      { name: 'base' },
      { name: 'left', depends_on: ['base'] },
      { name: 'right', depends_on: ['base'] },
      { name: 'top', depends_on: ['left', 'right'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    expect(result.maxDepth).toBe(2);
    const topInfo = result.scenarios.find((s) => s.name === 'top');
    expect(topInfo?.depth).toBe(2);
    expect(topInfo?.allDeps).toContain('base');
    expect(topInfo?.allDeps).toContain('left');
    expect(topInfo?.allDeps).toContain('right');
  });

  it('handles empty input', () => {
    const result = analyzeDependencyDepth([]);
    expect(result.maxDepth).toBe(0);
    expect(result.scenarios.length).toBe(0);
    expect(result.criticalPath.length).toBe(0);
  });

  it('sorts scenarios by depth descending', () => {
    const scenarios = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['b'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    expect(result.scenarios[0].name).toBe('c');
    expect(result.scenarios[1].name).toBe('b');
    expect(result.scenarios[2].name).toBe('a');
  });

  it('handles scenario with multiple missing deps', () => {
    const scenarios = [
      { name: 'broken', depends_on: ['x', 'y', 'z'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    const broken = result.scenarios[0];
    expect(broken.missingDeps.length).toBe(3);
    expect(broken.reachable).toBe(false);
  });
});

describe('formatDepthAnalysis', () => {
  it('formats empty results', () => {
    const result = analyzeDependencyDepth([]);
    const text = formatDepthAnalysis(result);
    expect(text).toContain('Dependency Depth Analysis');
    expect(text).toContain('No scenarios');
  });

  it('formats with data', () => {
    const scenarios = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    const text = formatDepthAnalysis(result);
    expect(text).toContain('Max depth');
    expect(text).toContain('Root nodes');
    expect(text).toContain('Leaf nodes');
  });

  it('shows unreachable warning', () => {
    const scenarios = [
      { name: 'a', depends_on: ['missing'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    const text = formatDepthAnalysis(result);
    expect(text).toContain('Unreachable');
    expect(text).toContain('⚠');
  });

  it('shows critical path', () => {
    const scenarios = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['b'] },
    ];
    const result = analyzeDependencyDepth(scenarios);
    const text = formatDepthAnalysis(result);
    expect(text).toContain('Critical path');
    expect(text).toContain('→');
  });
});
