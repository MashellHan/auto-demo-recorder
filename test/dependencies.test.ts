import { describe, it, expect } from 'vitest';
import {
  buildDependencyOrder,
  validateDependencies,
  buildDependencyGraph,
  formatDependencyGraph,
  type DependencyScenario,
} from '../src/config/dependencies.js';

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

  it('detects duplicate scenario names', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'a' },
    ];

    const errors = validateDependencies(scenarios);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Duplicate scenario name');
    expect(errors[0]).toContain('a');
  });

  it('does not produce spurious circular warning for duplicates without depends_on', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'a' },
    ];

    const errors = validateDependencies(scenarios);
    // Should report duplicate, NOT circular dependency
    expect(errors.every((e) => !e.toLowerCase().includes('circular'))).toBe(true);
  });
});

describe('buildDependencyGraph', () => {
  it('identifies roots and leaves', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'setup' },
      { name: 'build', depends_on: ['setup'] },
      { name: 'test', depends_on: ['build'] },
    ];
    const graph = buildDependencyGraph(scenarios);
    expect(graph.roots).toEqual(['setup']);
    expect(graph.leaves).toEqual(['test']);
    expect(graph.maxDepth).toBe(2);
    expect(graph.edges).toHaveLength(2);
  });

  it('handles independent scenarios', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
    ];
    const graph = buildDependencyGraph(scenarios);
    expect(graph.roots).toEqual(['a', 'b', 'c']);
    expect(graph.leaves).toEqual(['a', 'b', 'c']);
    expect(graph.maxDepth).toBe(0);
    expect(graph.edges).toHaveLength(0);
  });

  it('handles diamond dependency', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'setup' },
      { name: 'build', depends_on: ['setup'] },
      { name: 'lint', depends_on: ['setup'] },
      { name: 'deploy', depends_on: ['build', 'lint'] },
    ];
    const graph = buildDependencyGraph(scenarios);
    expect(graph.roots).toEqual(['setup']);
    expect(graph.leaves).toEqual(['deploy']);
    expect(graph.maxDepth).toBe(2);
    expect(graph.edges).toHaveLength(4);
  });

  it('handles empty scenarios', () => {
    const graph = buildDependencyGraph([]);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.maxDepth).toBe(0);
  });
});

describe('formatDependencyGraph', () => {
  it('formats independent scenarios', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'a' },
      { name: 'b' },
    ];
    const text = formatDependencyGraph(scenarios);
    expect(text).toContain('Dependency Graph');
    expect(text).toContain('No dependencies');
    expect(text).toContain('○ a');
    expect(text).toContain('○ b');
  });

  it('formats scenarios with dependencies', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'setup' },
      { name: 'build', depends_on: ['setup'] },
      { name: 'test', depends_on: ['build'] },
    ];
    const text = formatDependencyGraph(scenarios);
    expect(text).toContain('Dependency Graph');
    expect(text).toContain('setup (root)');
    expect(text).toContain('build → setup');
    expect(text).toContain('test → build');
    expect(text).toContain('Roots: setup');
    expect(text).toContain('Leaves: test');
    expect(text).toContain('Depth: 2');
  });

  it('returns message for empty scenarios', () => {
    const text = formatDependencyGraph([]);
    expect(text).toContain('No scenarios defined');
  });

  it('shows multiple dependencies', () => {
    const scenarios: DependencyScenario[] = [
      { name: 'setup' },
      { name: 'lint', depends_on: ['setup'] },
      { name: 'deploy', depends_on: ['setup', 'lint'] },
    ];
    const text = formatDependencyGraph(scenarios);
    expect(text).toContain('deploy → setup, lint');
  });
});
