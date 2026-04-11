import { describe, it, expect } from 'vitest';
import { checkDependencyHealth, formatDepHealth } from '../src/config/dep-health.js';
import type { DependencyScenario } from '../src/config/dependencies.js';

describe('checkDependencyHealth', () => {
  it('returns healthy for empty list', () => {
    const result = checkDependencyHealth([]);
    expect(result.healthy).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.totalScenarios).toBe(0);
  });

  it('returns healthy for independent scenarios', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.healthy).toBe(true);
    expect(result.rootCount).toBe(3);
    expect(result.maxDepth).toBe(0);
  });

  it('detects missing dependency targets', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['missing'] },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.healthy).toBe(false);
    const missing = result.issues.find((i) => i.code === 'MISSING_TARGET');
    expect(missing).toBeDefined();
    expect(missing!.scenarios).toContain('missing');
  });

  it('detects self-dependencies', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['a'] },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.healthy).toBe(false);
    expect(result.issues.some((i) => i.code === 'SELF_DEPENDENCY')).toBe(true);
  });

  it('detects cycles', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['b'] },
      { name: 'b', depends_on: ['a'] },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.healthy).toBe(false);
    expect(result.issues.some((i) => i.code === 'CYCLE')).toBe(true);
  });

  it('detects deep chains', () => {
    const scenarios: DependencyScenario[] = [];
    for (let i = 0; i < 8; i++) {
      scenarios.push({
        name: `s${i}`,
        depends_on: i > 0 ? [`s${i - 1}`] : [],
      });
    }
    const result = checkDependencyHealth(scenarios, 5);
    expect(result.maxDepth).toBe(7);
    expect(result.issues.some((i) => i.code === 'DEEP_CHAIN')).toBe(true);
  });

  it('does not warn about acceptable depth', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['b'] },
    ];
    const result = checkDependencyHealth(scenarios, 5);
    expect(result.issues.some((i) => i.code === 'DEEP_CHAIN')).toBe(false);
    expect(result.maxDepth).toBe(2);
  });

  it('detects high fan-out', () => {
    const deps = Array.from({ length: 6 }, (_, i) => `dep${i}`);
    const scenarios: DependencyScenario[] = [
      ...deps.map((name) => ({ name })),
      { name: 'consumer', depends_on: deps },
    ];
    const result = checkDependencyHealth(scenarios, 5, 5);
    expect(result.issues.some((i) => i.code === 'HIGH_FAN_OUT')).toBe(true);
  });

  it('detects high fan-in', () => {
    const consumers = Array.from({ length: 12 }, (_, i) => ({
      name: `c${i}`,
      depends_on: ['shared'],
    }));
    const scenarios: DependencyScenario[] = [
      { name: 'shared' },
      ...consumers,
    ];
    const result = checkDependencyHealth(scenarios, 5, 5, 10);
    expect(result.issues.some((i) => i.code === 'HIGH_FAN_IN')).toBe(true);
  });

  it('detects disconnected components', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['b'] },
      { name: 'b' },
      { name: 'c', depends_on: ['d'] },
      { name: 'd' },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.issues.some((i) => i.code === 'DISCONNECTED')).toBe(true);
  });

  it('reports correct root count', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'root1' },
      { name: 'root2' },
      { name: 'child', depends_on: ['root1'] },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.rootCount).toBe(2);
  });

  it('computes average fan-out', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['a', 'b'] },
    ];
    const result = checkDependencyHealth(scenarios);
    // Total fan-out: 0 + 1 + 2 = 3, avg = 1
    expect(result.avgFanOut).toBe(1);
  });

  it('sorts issues by severity', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['missing'] },
      { name: 'b' },
      { name: 'c' },
    ];
    const result = checkDependencyHealth(scenarios);
    if (result.issues.length >= 2) {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      for (let i = 1; i < result.issues.length; i++) {
        expect(severityOrder[result.issues[i].severity])
          .toBeGreaterThanOrEqual(severityOrder[result.issues[i - 1].severity]);
      }
    }
  });

  it('handles healthy linear chain', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['b'] },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.healthy).toBe(true);
    expect(result.rootCount).toBe(1);
    expect(result.maxDepth).toBe(2);
  });

  it('handles diamond dependency', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'root' },
      { name: 'left', depends_on: ['root'] },
      { name: 'right', depends_on: ['root'] },
      { name: 'bottom', depends_on: ['left', 'right'] },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.healthy).toBe(true);
    expect(result.maxDepth).toBe(2);
  });

  it('counts leaves correctly', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
    ];
    const result = checkDependencyHealth(scenarios);
    expect(result.leafCount).toBe(1);
    expect(result.rootCount).toBe(1);
  });
});

describe('formatDepHealth', () => {
  it('formats empty result', () => {
    const result = checkDependencyHealth([]);
    const text = formatDepHealth(result);
    expect(text).toContain('Dependency Health');
    expect(text).toContain('No scenarios');
  });

  it('formats healthy result', () => {
    const scenarios: DependencyScenario[] = [{ name: 'a' }, { name: 'b', depends_on: ['a'] }];
    const result = checkDependencyHealth(scenarios);
    const text = formatDepHealth(result);
    expect(text).toContain('✅ healthy');
    expect(text).toContain('No issues');
  });

  it('formats unhealthy result', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['missing'] },
    ];
    const result = checkDependencyHealth(scenarios);
    const text = formatDepHealth(result);
    expect(text).toContain('❌ unhealthy');
    expect(text).toContain('MISSING_TARGET');
  });

  it('shows severity icons', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['b'] },
      { name: 'b', depends_on: ['a'] },
    ];
    const result = checkDependencyHealth(scenarios);
    const text = formatDepHealth(result);
    expect(text).toContain('❌');
  });

  it('shows statistics', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'root' },
      { name: 'child', depends_on: ['root'] },
    ];
    const result = checkDependencyHealth(scenarios);
    const text = formatDepHealth(result);
    expect(text).toContain('roots');
    expect(text).toContain('Max depth');
    expect(text).toContain('Avg fan-out');
  });
});
