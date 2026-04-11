import { describe, it, expect } from 'vitest';
import { analyzePareto, formatPareto } from '../src/analytics/pareto.js';
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

describe('analyzePareto', () => {
  it('returns no-data for empty entries', () => {
    const result = analyzePareto([]);
    expect(result.hasData).toBe(false);
    expect(result.analyses.length).toBe(0);
  });

  it('produces 3 category analyses', () => {
    const entries = [makeEntry()];
    const result = analyzePareto(entries);
    expect(result.analyses.length).toBe(3);
    expect(result.analyses.map((a) => a.category)).toEqual(['failures', 'bugs', 'duration']);
  });

  it('failure analysis only includes failed entries', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'error' }),
      makeEntry({ scenario: 'a', status: 'error' }),
      makeEntry({ scenario: 'b', status: 'ok' }),
    ];
    const result = analyzePareto(entries);
    const failures = result.analyses.find((a) => a.category === 'failures')!;
    expect(failures.items.length).toBe(1);
    expect(failures.items[0]!.scenario).toBe('a');
    expect(failures.items[0]!.value).toBe(2);
  });

  it('bug analysis sums bug counts', () => {
    const entries = [
      makeEntry({ scenario: 'a', bugsFound: 3 }),
      makeEntry({ scenario: 'a', bugsFound: 2 }),
      makeEntry({ scenario: 'b', bugsFound: 1 }),
    ];
    const result = analyzePareto(entries);
    const bugs = result.analyses.find((a) => a.category === 'bugs')!;
    expect(bugs.total).toBe(6);
    expect(bugs.items[0]!.scenario).toBe('a');
    expect(bugs.items[0]!.value).toBe(5);
  });

  it('duration analysis sums total duration', () => {
    const entries = [
      makeEntry({ scenario: 'slow', durationSeconds: 100 }),
      makeEntry({ scenario: 'fast', durationSeconds: 5 }),
    ];
    const result = analyzePareto(entries);
    const duration = result.analyses.find((a) => a.category === 'duration')!;
    expect(duration.total).toBe(105);
    expect(duration.items[0]!.scenario).toBe('slow');
  });

  it('items sorted descending by value', () => {
    const entries = [
      makeEntry({ scenario: 'small', status: 'error' }),
      makeEntry({ scenario: 'big', status: 'error' }),
      makeEntry({ scenario: 'big', status: 'error' }),
      makeEntry({ scenario: 'big', status: 'error' }),
    ];
    const result = analyzePareto(entries);
    const failures = result.analyses.find((a) => a.category === 'failures')!;
    expect(failures.items[0]!.scenario).toBe('big');
    expect(failures.items[1]!.scenario).toBe('small');
  });

  it('cumulative percentages increase', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'error' }),
      makeEntry({ scenario: 'a', status: 'error' }),
      makeEntry({ scenario: 'b', status: 'error' }),
      makeEntry({ scenario: 'c', status: 'error' }),
    ];
    const result = analyzePareto(entries);
    const failures = result.analyses.find((a) => a.category === 'failures')!;
    for (let i = 1; i < failures.items.length; i++) {
      expect(failures.items[i]!.cumulative).toBeGreaterThan(failures.items[i - 1]!.cumulative);
    }
  });

  it('identifies vital few items', () => {
    const entries = [
      // a has 80 failures, b has 10, c has 10 → a is vital few
      ...Array.from({ length: 80 }, () => makeEntry({ scenario: 'a', status: 'error' })),
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'b', status: 'error' })),
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'c', status: 'error' })),
    ];
    const result = analyzePareto(entries);
    const failures = result.analyses.find((a) => a.category === 'failures')!;
    expect(failures.items[0]!.isVitalFew).toBe(true);
    expect(failures.items[0]!.scenario).toBe('a');
    expect(failures.vitalFewCount).toBe(1);
  });

  it('at least one item is always vital few', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'error' }),
      makeEntry({ scenario: 'b', status: 'error' }),
      makeEntry({ scenario: 'c', status: 'error' }),
      makeEntry({ scenario: 'd', status: 'error' }),
      makeEntry({ scenario: 'e', status: 'error' }),
    ];
    const result = analyzePareto(entries);
    const failures = result.analyses.find((a) => a.category === 'failures')!;
    expect(failures.vitalFewCount).toBeGreaterThanOrEqual(1);
  });

  it('empty category has no items', () => {
    const entries = [
      makeEntry({ status: 'ok', bugsFound: 0 }), // No failures, no bugs
    ];
    const result = analyzePareto(entries);
    const failures = result.analyses.find((a) => a.category === 'failures')!;
    expect(failures.items.length).toBe(0);
    expect(failures.total).toBe(0);
  });

  it('computes vitalFewPercentage', () => {
    const entries = [
      ...Array.from({ length: 8 }, () => makeEntry({ scenario: 'main', status: 'error' })),
      makeEntry({ scenario: 'other1', status: 'error' }),
      makeEntry({ scenario: 'other2', status: 'error' }),
    ];
    const result = analyzePareto(entries);
    const failures = result.analyses.find((a) => a.category === 'failures')!;
    expect(failures.vitalFewPercentage).toBeGreaterThan(0);
    expect(failures.vitalFewPercentage).toBeLessThanOrEqual(100);
  });

  it('counts total recordings', () => {
    const entries = [makeEntry(), makeEntry(), makeEntry()];
    const result = analyzePareto(entries);
    expect(result.totalRecordings).toBe(3);
  });

  it('counts total scenarios', () => {
    const entries = [
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
      makeEntry({ scenario: 'a' }),
    ];
    const result = analyzePareto(entries);
    expect(result.totalScenarios).toBe(2);
  });

  it('percentage sums to approximately 100', () => {
    const entries = [
      ...Array.from({ length: 5 }, () => makeEntry({ scenario: 'a', status: 'error' })),
      ...Array.from({ length: 3 }, () => makeEntry({ scenario: 'b', status: 'error' })),
      ...Array.from({ length: 2 }, () => makeEntry({ scenario: 'c', status: 'error' })),
    ];
    const result = analyzePareto(entries);
    const failures = result.analyses.find((a) => a.category === 'failures')!;
    const totalPct = failures.items.reduce((s, i) => s + i.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

describe('formatPareto', () => {
  it('formats no-data result', () => {
    const result = analyzePareto([]);
    const text = formatPareto(result);
    expect(text).toContain('Pareto');
    expect(text).toContain('No recording data');
  });

  it('formats result with data', () => {
    const entries = [
      makeEntry({ status: 'error', bugsFound: 2 }),
      makeEntry({ status: 'ok', bugsFound: 0 }),
    ];
    const result = analyzePareto(entries);
    const text = formatPareto(result);
    expect(text).toContain('Pareto');
    expect(text).toContain('Failures');
    expect(text).toContain('Bugs Found');
    expect(text).toContain('Duration');
  });

  it('shows vital/trivial labels', () => {
    const entries = [
      ...Array.from({ length: 8 }, () => makeEntry({ scenario: 'main', status: 'error' })),
      makeEntry({ scenario: 'minor', status: 'error' }),
    ];
    const result = analyzePareto(entries);
    const text = formatPareto(result);
    expect(text).toContain('vital');
  });

  it('shows (none) for empty categories', () => {
    const entries = [makeEntry({ status: 'ok', bugsFound: 0 })];
    const result = analyzePareto(entries);
    const text = formatPareto(result);
    expect(text).toContain('(none)');
  });
});
