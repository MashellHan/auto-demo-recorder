import { describe, it, expect } from 'vitest';
import { analyzeDistribution, formatDistribution } from '../src/analytics/distribution.js';
import type { HistoryEntry } from '../src/analytics/history.js';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-04-11T10:00:00.000Z',
    sessionId: 's1',
    scenario: 'demo',
    status: 'ok',
    durationSeconds: 5,
    bugsFound: 0,
    backend: 'vhs',
    ...overrides,
  };
}

describe('analyzeDistribution', () => {
  it('returns empty for no entries', () => {
    const result = analyzeDistribution([]);
    expect(result.scenarios).toEqual([]);
    expect(result.giniCoefficient).toBe(0);
    expect(result.evennessScore).toBe(100);
    expect(result.totalRecordings).toBe(0);
    expect(result.mostRecorded).toBeNull();
    expect(result.leastRecorded).toBeNull();
  });

  it('computes even distribution', () => {
    const entries = [
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
      makeEntry({ scenario: 'c' }),
    ];
    const result = analyzeDistribution(entries);
    expect(result.scenarioCount).toBe(3);
    expect(result.giniCoefficient).toBe(0);
    expect(result.evennessScore).toBe(100);
    expect(result.expectedPerScenario).toBe(1);
  });

  it('computes uneven distribution', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'heavy' })),
      makeEntry({ scenario: 'light' }),
    ];
    const result = analyzeDistribution(entries);
    expect(result.giniCoefficient).toBeGreaterThan(0.3);
    expect(result.evennessScore).toBeLessThan(70);
    expect(result.mostRecorded?.name).toBe('heavy');
    expect(result.leastRecorded?.name).toBe('light');
  });

  it('computes per-scenario percentages', () => {
    const entries = [
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
      makeEntry({ scenario: 'b' }),
    ];
    const result = analyzeDistribution(entries);
    const a = result.scenarios.find((s) => s.name === 'a')!;
    expect(a.percentage).toBe(50);
  });

  it('identifies under-recorded scenarios', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'a' })),
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'b' })),
      makeEntry({ scenario: 'c' }),
    ];
    const result = analyzeDistribution(entries);
    const c = result.scenarios.find((s) => s.name === 'c')!;
    expect(c.underRecorded).toBe(true);
  });

  it('identifies over-recorded scenarios', () => {
    const entries = [
      ...Array.from({ length: 20 }, () => makeEntry({ scenario: 'heavy' })),
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
    ];
    const result = analyzeDistribution(entries);
    const heavy = result.scenarios.find((s) => s.name === 'heavy')!;
    expect(heavy.overRecorded).toBe(true);
  });

  it('computes deviation from expected', () => {
    const entries = [
      ...Array.from({ length: 6 }, () => makeEntry({ scenario: 'a' })),
      ...Array.from({ length: 2 }, () => makeEntry({ scenario: 'b' })),
    ];
    const result = analyzeDistribution(entries);
    const a = result.scenarios.find((s) => s.name === 'a')!;
    const b = result.scenarios.find((s) => s.name === 'b')!;
    expect(a.deviation).toBeGreaterThan(0);
    expect(b.deviation).toBeLessThan(0);
  });

  it('sorts by count descending', () => {
    const entries = [
      makeEntry({ scenario: 'b' }),
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'a' }),
    ];
    const result = analyzeDistribution(entries);
    expect(result.scenarios[0].name).toBe('a');
    expect(result.scenarios[1].name).toBe('b');
  });

  it('handles single scenario', () => {
    const entries = [
      makeEntry({ scenario: 'solo' }),
      makeEntry({ scenario: 'solo' }),
    ];
    const result = analyzeDistribution(entries);
    expect(result.scenarioCount).toBe(1);
    expect(result.giniCoefficient).toBe(0);
    expect(result.evennessScore).toBe(100);
  });

  it('handles single entry', () => {
    const result = analyzeDistribution([makeEntry()]);
    expect(result.totalRecordings).toBe(1);
    expect(result.scenarioCount).toBe(1);
    expect(result.evennessScore).toBe(100);
  });

  it('gini is between 0 and 1', () => {
    const entries = [
      ...Array.from({ length: 100 }, () => makeEntry({ scenario: 'dominant' })),
      makeEntry({ scenario: 'rare' }),
    ];
    const result = analyzeDistribution(entries);
    expect(result.giniCoefficient).toBeGreaterThanOrEqual(0);
    expect(result.giniCoefficient).toBeLessThanOrEqual(1);
  });
});

describe('formatDistribution', () => {
  it('formats empty result', () => {
    const result = analyzeDistribution([]);
    const text = formatDistribution(result);
    expect(text).toContain('Recording Distribution Analysis');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
      makeEntry({ scenario: 'b' }),
    ];
    const result = analyzeDistribution(entries);
    const text = formatDistribution(result);
    expect(text).toContain('Total recordings');
    expect(text).toContain('Gini coefficient');
    expect(text).toContain('Evenness');
    expect(text).toContain('Distribution');
    expect(text).toContain('█');
  });

  it('shows most/least recorded', () => {
    const entries = [
      ...Array.from({ length: 5 }, () => makeEntry({ scenario: 'popular' })),
      makeEntry({ scenario: 'rare' }),
    ];
    const result = analyzeDistribution(entries);
    const text = formatDistribution(result);
    expect(text).toContain('Most recorded');
    expect(text).toContain('Least recorded');
    expect(text).toContain('popular');
    expect(text).toContain('rare');
  });

  it('shows under/over-recorded flags', () => {
    const entries = [
      ...Array.from({ length: 20 }, () => makeEntry({ scenario: 'heavy' })),
      makeEntry({ scenario: 'light' }),
    ];
    const result = analyzeDistribution(entries);
    const text = formatDistribution(result);
    expect(text).toContain('⬇');
    expect(text).toContain('⬆');
  });

  it('shows evenness icon', () => {
    const result = analyzeDistribution([makeEntry()]);
    const text = formatDistribution(result);
    expect(text).toMatch(/🟢|🟡|🔴/);
  });
});
