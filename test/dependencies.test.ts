import { describe, it, expect } from 'vitest';
import { buildDependencyOrder, validateDependencies, type DependencyScenario } from '../src/config/dependencies.js';

describe('buildDependencyOrder', () => {
  it('returns scenarios in dependency order', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'deploy', depends_on: ['build'] },
      { name: 'build', depends_on: ['test'] },
      { name: 'test', depends_on: [] },
    ];

    const order = buildDependencyOrder(scenarios);

    expect(order.map((s) => s.name)).toEqual(['test', 'build', 'deploy']);
  });

  it('handles scenarios with no dependencies', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
    ];

    const order = buildDependencyOrder(scenarios);

    // All scenarios should be included
    expect(order).toHaveLength(3);
    expect(order.map((s) => s.name).sort()).toEqual(['a', 'b', 'c']);
  });

  it('handles diamond dependency', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'd', depends_on: ['b', 'c'] },
      { name: 'b', depends_on: ['a'] },
      { name: 'c', depends_on: ['a'] },
      { name: 'a', depends_on: [] },
    ];

    const order = buildDependencyOrder(scenarios);
    const names = order.map((s) => s.name);

    // 'a' must come before 'b' and 'c', and 'd' must come last
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'));
    expect(names.indexOf('a')).toBeLessThan(names.indexOf('c'));
    expect(names.indexOf('b')).toBeLessThan(names.indexOf('d'));
    expect(names.indexOf('c')).toBeLessThan(names.indexOf('d'));
  });

  it('handles single scenario', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'only', depends_on: [] },
    ];

    const order = buildDependencyOrder(scenarios);
    expect(order).toHaveLength(1);
    expect(order[0].name).toBe('only');
  });

  it('handles empty input', () => {
    const order = buildDependencyOrder([]);
    expect(order).toHaveLength(0);
  });
});

describe('validateDependencies', () => {
  it('returns no errors for valid dependencies', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: [] },
      { name: 'b', depends_on: ['a'] },
    ];

    const errors = validateDependencies(scenarios);
    expect(errors).toHaveLength(0);
  });

  it('detects missing dependencies', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['nonexistent'] },
    ];

    const errors = validateDependencies(scenarios);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('nonexistent');
  });

  it('detects circular dependencies', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['b'] },
      { name: 'b', depends_on: ['a'] },
    ];

    const errors = validateDependencies(scenarios);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.toLowerCase().includes('circular'))).toBe(true);
  });

  it('detects self-dependency', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a', depends_on: ['a'] },
    ];

    const errors = validateDependencies(scenarios);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns empty for no scenarios', () => {
    expect(validateDependencies([])).toHaveLength(0);
  });
});
