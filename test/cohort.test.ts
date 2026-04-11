import { describe, it, expect } from 'vitest';
import { analyzeCohorts, formatCohorts } from '../src/analytics/cohort.js';
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

describe('analyzeCohorts', () => {
  it('returns no-data for empty entries', () => {
    const result = analyzeCohorts([]);
    expect(result.hasData).toBe(false);
    expect(result.cohorts.length).toBe(0);
    expect(result.totalScenarios).toBe(0);
  });

  it('creates a single cohort when all scenarios start in same period', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z', scenario: 'b' }),
      makeEntry({ timestamp: '2026-04-09T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    expect(result.hasData).toBe(true);
    expect(result.cohorts.length).toBe(1);
    expect(result.cohorts[0]!.scenarios).toContain('a');
    expect(result.cohorts[0]!.scenarios).toContain('b');
  });

  it('creates separate cohorts for scenarios starting in different periods', () => {
    const entries = [
      makeEntry({ timestamp: '2026-03-01T10:00:00.000Z', scenario: 'old' }),
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'new' }),
    ];
    const result = analyzeCohorts(entries, 'monthly');
    expect(result.cohorts.length).toBe(2);
  });

  it('tracks recordings across periods', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-15T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    expect(result.cohorts.length).toBe(1);
    expect(result.cohorts[0]!.periods.length).toBeGreaterThanOrEqual(3);
  });

  it('computes success rate per period', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-07T11:00:00.000Z', scenario: 'a', status: 'error' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    const period0 = result.cohorts[0]!.periods[0]!;
    expect(period0.successRate).toBe(50);
  });

  it('computes retention rate based on active scenarios', () => {
    const entries = [
      // Week 14 (Apr 3-4): both a and b active
      makeEntry({ timestamp: '2026-04-03T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-04T10:00:00.000Z', scenario: 'b' }),
      // Week 15 (Apr 10): only a active
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    // Both should be in the same cohort
    expect(result.cohorts.length).toBe(1);
    const period1 = result.cohorts[0]!.periods.find((p) => p.periodIndex === 1);
    expect(period1).toBeDefined();
    expect(period1!.retentionRate).toBe(50); // 1 of 2 scenarios retained
  });

  it('retention rate is 100% at period 0', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z', scenario: 'b' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    const period0 = result.cohorts[0]!.periods[0]!;
    expect(period0.retentionRate).toBe(100);
  });

  it('counts total scenarios', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z', scenario: 'b' }),
      makeEntry({ timestamp: '2026-04-09T10:00:00.000Z', scenario: 'c' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    expect(result.totalScenarios).toBe(3);
  });

  it('counts total recordings', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    expect(result.totalRecordings).toBe(2);
  });

  it('computes avg retention at period 1', () => {
    const entries = [
      // Cohort 1: scenarios a, b — both active in week 1
      makeEntry({ timestamp: '2026-03-03T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-03-04T10:00:00.000Z', scenario: 'b' }),
      // Cohort 1 week 2: only a active = 50% retention
      makeEntry({ timestamp: '2026-03-10T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    expect(result.avgRetentionPeriod1).toBeGreaterThan(0);
  });

  it('sorts scenarios within cohort alphabetically', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'zebra' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z', scenario: 'apple' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    expect(result.cohorts[0]!.scenarios[0]).toBe('apple');
    expect(result.cohorts[0]!.scenarios[1]).toBe('zebra');
  });

  it('uses monthly granularity correctly', () => {
    const entries = [
      makeEntry({ timestamp: '2026-03-15T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-15T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'monthly');
    expect(result.granularity).toBe('monthly');
    expect(result.cohorts.length).toBe(1);
    expect(result.cohorts[0]!.periods.length).toBe(2);
  });

  it('period labels match granularity', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
    ];
    const weeklyResult = analyzeCohorts(entries, 'weekly');
    expect(weeklyResult.cohorts[0]!.periods[0]!.period).toContain('Week');

    const monthlyResult = analyzeCohorts(entries, 'monthly');
    expect(monthlyResult.cohorts[0]!.periods[0]!.period).toContain('Month');
  });

  it('period index starts at 0 for each cohort', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-14T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    expect(result.cohorts[0]!.periods[0]!.periodIndex).toBe(0);
    expect(result.cohorts[0]!.periods[1]!.periodIndex).toBe(1);
  });

  it('sets firstSeen to earliest date for the cohort', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-09T10:00:00.000Z', scenario: 'b' }),
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    expect(result.cohorts[0]!.firstSeen).toBe('2026-04-07');
  });

  it('handles multiple cohorts with different start periods', () => {
    const entries = [
      makeEntry({ timestamp: '2026-03-01T10:00:00.000Z', scenario: 'march' }),
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z', scenario: 'april' }),
      // Both continue in April
      makeEntry({ timestamp: '2026-04-15T10:00:00.000Z', scenario: 'march' }),
      makeEntry({ timestamp: '2026-04-15T10:00:00.000Z', scenario: 'april' }),
    ];
    const result = analyzeCohorts(entries, 'monthly');
    expect(result.cohorts.length).toBe(2);
    expect(result.cohorts[0]!.scenarios).toContain('march');
    expect(result.cohorts[1]!.scenarios).toContain('april');
  });
});

describe('formatCohorts', () => {
  it('formats no-data result', () => {
    const result = analyzeCohorts([]);
    const text = formatCohorts(result);
    expect(text).toContain('Cohort Analysis');
    expect(text).toContain('No recording data');
  });

  it('formats cohort with data', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z', scenario: 'b' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    const text = formatCohorts(result);
    expect(text).toContain('Cohort');
    expect(text).toContain('Recordings');
    expect(text).toContain('Retention');
  });

  it('shows weekly label', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    const text = formatCohorts(result);
    expect(text).toContain('Weekly');
  });

  it('shows monthly label', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'a' }),
    ];
    const result = analyzeCohorts(entries, 'monthly');
    const text = formatCohorts(result);
    expect(text).toContain('Monthly');
  });

  it('shows scenario names in cohort', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z', scenario: 'alpha' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z', scenario: 'beta' }),
    ];
    const result = analyzeCohorts(entries, 'weekly');
    const text = formatCohorts(result);
    expect(text).toContain('alpha');
    expect(text).toContain('beta');
  });
});
