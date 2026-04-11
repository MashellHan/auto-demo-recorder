import { describe, it, expect } from 'vitest';
import { analyzeFunnel, formatFunnel } from '../src/analytics/funnel.js';
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

describe('analyzeFunnel', () => {
  it('returns no-data for empty entries', () => {
    const result = analyzeFunnel([]);
    expect(result.hasData).toBe(false);
    expect(result.stages.length).toBe(0);
    expect(result.totalRecordings).toBe(0);
  });

  it('creates 4 funnel stages', () => {
    const entries = [makeEntry()];
    const result = analyzeFunnel(entries);
    expect(result.stages.length).toBe(4);
    expect(result.stages.map((s) => s.name)).toEqual(['Total', 'Successful', 'Bug-free', 'Fast']);
  });

  it('first stage has 100% of total', () => {
    const entries = [makeEntry(), makeEntry()];
    const result = analyzeFunnel(entries);
    expect(result.stages[0]!.percentOfTotal).toBe(100);
    expect(result.stages[0]!.count).toBe(2);
  });

  it('first stage has 0 drop-off', () => {
    const entries = [makeEntry()];
    const result = analyzeFunnel(entries);
    expect(result.stages[0]!.dropOff).toBe(0);
  });

  it('successful stage filters by status ok', () => {
    const entries = [
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'error' }),
      makeEntry({ status: 'ok' }),
    ];
    const result = analyzeFunnel(entries);
    const successful = result.stages.find((s) => s.name === 'Successful');
    expect(successful!.count).toBe(2);
    expect(successful!.dropOff).toBe(1);
  });

  it('bug-free stage filters by zero bugs', () => {
    const entries = [
      makeEntry({ status: 'ok', bugsFound: 0 }),
      makeEntry({ status: 'ok', bugsFound: 3 }),
    ];
    const result = analyzeFunnel(entries);
    const bugFree = result.stages.find((s) => s.name === 'Bug-free');
    expect(bugFree!.count).toBe(1);
  });

  it('fast stage filters by below-average duration', () => {
    const entries = [
      makeEntry({ status: 'ok', bugsFound: 0, durationSeconds: 2 }),
      makeEntry({ status: 'ok', bugsFound: 0, durationSeconds: 4 }),
      makeEntry({ status: 'ok', bugsFound: 0, durationSeconds: 6 }),
    ];
    // Avg duration = 4, so only entries with duration <= 4 pass
    const result = analyzeFunnel(entries);
    const fast = result.stages.find((s) => s.name === 'Fast');
    expect(fast!.count).toBe(2); // 2s and 4s pass
  });

  it('computes conversion rates', () => {
    const entries = [
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'error' }),
    ];
    const result = analyzeFunnel(entries);
    const successful = result.stages.find((s) => s.name === 'Successful');
    expect(successful!.conversionRate).toBe(50);
  });

  it('identifies biggest drop-off', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ status: 'ok' })),
      ...Array.from({ length: 5 }, () => makeEntry({ status: 'error' })),
    ];
    const result = analyzeFunnel(entries);
    expect(result.biggestDropOff).toBe('Successful');
  });

  it('computes throughput', () => {
    const entries = [
      makeEntry({ status: 'ok', bugsFound: 0, durationSeconds: 3 }),
      makeEntry({ status: 'ok', bugsFound: 0, durationSeconds: 5 }),
      makeEntry({ status: 'error', bugsFound: 0, durationSeconds: 2 }),
    ];
    const result = analyzeFunnel(entries);
    expect(result.throughput).toBeGreaterThan(0);
    expect(result.throughputRate).toBeGreaterThan(0);
  });

  it('generates per-scenario funnels', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'ok' }),
      makeEntry({ scenario: 'a', status: 'error' }),
      makeEntry({ scenario: 'b', status: 'ok' }),
    ];
    const result = analyzeFunnel(entries);
    expect(result.scenarioFunnels.length).toBe(2);
  });

  it('per-scenario funnel has correct success rate', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'ok' }),
      makeEntry({ scenario: 'a', status: 'error' }),
    ];
    const result = analyzeFunnel(entries);
    const aFunnel = result.scenarioFunnels.find((f) => f.scenario === 'a');
    expect(aFunnel!.successRate).toBe(50);
  });

  it('per-scenario funnel has correct bug-free rate', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'ok', bugsFound: 0 }),
      makeEntry({ scenario: 'a', status: 'ok', bugsFound: 2 }),
    ];
    const result = analyzeFunnel(entries);
    const aFunnel = result.scenarioFunnels.find((f) => f.scenario === 'a');
    expect(aFunnel!.bugFreeRate).toBe(50);
  });

  it('scenarios sorted by total count descending', () => {
    const entries = [
      makeEntry({ scenario: 'small' }),
      makeEntry({ scenario: 'big' }),
      makeEntry({ scenario: 'big' }),
      makeEntry({ scenario: 'big' }),
    ];
    const result = analyzeFunnel(entries);
    expect(result.scenarioFunnels[0]!.scenario).toBe('big');
  });

  it('handles all perfect entries', () => {
    const entries = Array.from({ length: 5 }, () => makeEntry());
    const result = analyzeFunnel(entries);
    expect(result.stages[0]!.count).toBe(5);
    expect(result.stages[1]!.count).toBe(5); // All ok
    expect(result.stages[2]!.count).toBe(5); // All bug-free
    // All have same duration, avg = 5, fast = all with duration <= 5
    expect(result.stages[3]!.count).toBe(5);
    expect(result.throughputRate).toBe(100);
  });

  it('percentOfTotal never exceeds 100', () => {
    const entries = [makeEntry(), makeEntry()];
    const result = analyzeFunnel(entries);
    for (const s of result.stages) {
      expect(s.percentOfTotal).toBeLessThanOrEqual(100);
    }
  });
});

describe('formatFunnel', () => {
  it('formats no-data result', () => {
    const result = analyzeFunnel([]);
    const text = formatFunnel(result);
    expect(text).toContain('Funnel');
    expect(text).toContain('No recording data');
  });

  it('formats funnel with data', () => {
    const entries = [
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'error' }),
    ];
    const result = analyzeFunnel(entries);
    const text = formatFunnel(result);
    expect(text).toContain('Funnel');
    expect(text).toContain('Total');
    expect(text).toContain('Successful');
    expect(text).toContain('Throughput');
  });

  it('shows bar chart', () => {
    const entries = [makeEntry(), makeEntry()];
    const result = analyzeFunnel(entries);
    const text = formatFunnel(result);
    expect(text).toContain('█');
  });

  it('shows per-scenario table', () => {
    const entries = [
      makeEntry({ scenario: 'alpha' }),
      makeEntry({ scenario: 'beta' }),
    ];
    const result = analyzeFunnel(entries);
    const text = formatFunnel(result);
    expect(text).toContain('Per-scenario');
    expect(text).toContain('alpha');
    expect(text).toContain('beta');
  });
});
