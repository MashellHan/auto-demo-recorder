import { describe, it, expect } from 'vitest';
import { scoreComplexity, formatComplexity } from '../src/analytics/complexity.js';
import type { ComplexityScenario } from '../src/analytics/complexity.js';

function makeScenario(overrides: Partial<ComplexityScenario> = {}): ComplexityScenario {
  return {
    name: 'basic',
    steps: [{ type: 'type', action: 'type' }],
    ...overrides,
  };
}

describe('scoreComplexity', () => {
  it('scores simple scenario as simple', () => {
    const result = scoreComplexity([makeScenario({ steps: [{ type: 'type' }] })]);
    expect(result.scores[0].grade).toBe('simple');
    expect(result.scores[0].score).toBeLessThanOrEqual(25);
  });

  it('increases score with more steps', () => {
    const few = scoreComplexity([makeScenario({ steps: Array.from({ length: 3 }, () => ({ type: 'type' })) })]);
    const many = scoreComplexity([makeScenario({ steps: Array.from({ length: 15 }, () => ({ type: 'type' })) })]);
    expect(many.scores[0].factors.stepCount).toBeGreaterThan(few.scores[0].factors.stepCount);
  });

  it('increases score with step diversity', () => {
    const uniform = scoreComplexity([makeScenario({
      steps: [{ type: 'type' }, { type: 'type' }, { type: 'type' }],
    })]);
    const diverse = scoreComplexity([makeScenario({
      steps: [{ type: 'type' }, { type: 'wait' }, { type: 'key' }],
    })]);
    expect(diverse.scores[0].factors.stepDiversity).toBeGreaterThan(uniform.scores[0].factors.stepDiversity);
  });

  it('increases score with dependencies', () => {
    const noDeps = scoreComplexity([makeScenario()]);
    const withDeps = scoreComplexity([makeScenario({ depends_on: ['a', 'b'] })]);
    expect(withDeps.scores[0].factors.dependencies).toBeGreaterThan(noDeps.scores[0].factors.dependencies);
  });

  it('increases score with hooks', () => {
    const noHooks = scoreComplexity([makeScenario()]);
    const withHooks = scoreComplexity([makeScenario({ hooks: { before: 'cmd' } })]);
    expect(withHooks.scores[0].factors.hooks).toBe(15);
    expect(noHooks.scores[0].factors.hooks).toBe(0);
  });

  it('increases score with tags', () => {
    const noTags = scoreComplexity([makeScenario()]);
    const withTags = scoreComplexity([makeScenario({ tags: ['a', 'b', 'c'] })]);
    expect(withTags.scores[0].factors.tags).toBeGreaterThan(noTags.scores[0].factors.tags);
  });

  it('caps score at 100', () => {
    const complex = makeScenario({
      steps: Array.from({ length: 30 }, (_, i) => ({ type: `type-${i}` })),
      depends_on: ['a', 'b', 'c'],
      hooks: { before: 'cmd', after: 'cmd' },
      tags: ['a', 'b', 'c', 'd', 'e'],
    });
    const result = scoreComplexity([complex]);
    expect(result.scores[0].score).toBeLessThanOrEqual(100);
  });

  it('classifies grades correctly', () => {
    // Simple
    const simple = scoreComplexity([makeScenario({ steps: [{ type: 'type' }] })]);
    expect(simple.scores[0].grade).toBe('simple');

    // Complex
    const complex = makeScenario({
      steps: Array.from({ length: 20 }, (_, i) => ({ type: `type-${i}` })),
      depends_on: ['a', 'b'],
    });
    const complexResult = scoreComplexity([complex]);
    expect(['moderate', 'complex', 'very-complex']).toContain(complexResult.scores[0].grade);
  });

  it('sorts by score descending', () => {
    const scenarios = [
      makeScenario({ name: 'simple', steps: [{ type: 'type' }] }),
      makeScenario({
        name: 'complex',
        steps: Array.from({ length: 15 }, () => ({ type: 'type' })),
        depends_on: ['a'],
      }),
    ];
    const result = scoreComplexity(scenarios);
    expect(result.scores[0].name === 'complex' || result.scores[0].score >= result.scores[1].score).toBe(true);
  });

  it('computes average score', () => {
    const scenarios = [
      makeScenario({ name: 'a', steps: [{ type: 'type' }] }),
      makeScenario({ name: 'b', steps: [{ type: 'type' }] }),
    ];
    const result = scoreComplexity(scenarios);
    expect(result.averageScore).toBeGreaterThanOrEqual(0);
  });

  it('computes distribution', () => {
    const scenarios = [
      makeScenario({ name: 'a', steps: [{ type: 'type' }] }),
    ];
    const result = scoreComplexity(scenarios);
    expect(result.distribution.simple).toBe(1);
  });

  it('provides refactoring recommendation', () => {
    const complex = makeScenario({
      steps: Array.from({ length: 20 }, () => ({ type: 'type' })),
      depends_on: ['a', 'b', 'c'],
    });
    const result = scoreComplexity([complex]);
    expect(result.scores[0].recommendation).toContain('split');
  });

  it('handles empty input', () => {
    const result = scoreComplexity([]);
    expect(result.scores.length).toBe(0);
    expect(result.averageScore).toBe(0);
  });
});

describe('formatComplexity', () => {
  it('formats empty results', () => {
    const result = scoreComplexity([]);
    const text = formatComplexity(result);
    expect(text).toContain('Scenario Complexity Report');
    expect(text).toContain('No scenarios');
  });

  it('formats with data', () => {
    const result = scoreComplexity([makeScenario()]);
    const text = formatComplexity(result);
    expect(text).toContain('Average complexity');
    expect(text).toContain('Distribution');
    expect(text).toContain('basic');
  });

  it('shows grade icons', () => {
    const result = scoreComplexity([makeScenario()]);
    const text = formatComplexity(result);
    expect(text).toContain('🟢');
  });
});
