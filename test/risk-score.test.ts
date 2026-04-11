import { describe, it, expect } from 'vitest';
import { computeRiskScores, formatRiskScores } from '../src/analytics/risk-score.js';
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

describe('computeRiskScores', () => {
  it('returns empty for no entries', () => {
    const result = computeRiskScores([]);
    expect(result.scenarios).toEqual([]);
    expect(result.averageRisk).toBe(0);
    expect(result.totalScenarios).toBe(0);
  });

  it('scores healthy scenario as low risk', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 10 }, () =>
      makeEntry({ status: 'ok', durationSeconds: 5 }),
    );
    const result = computeRiskScores(entries, now);
    expect(result.scenarios[0].riskLevel).toBe('low');
    expect(result.scenarios[0].riskScore).toBeLessThan(20);
  });

  it('increases risk with failure rate', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      ...Array.from({ length: 5 }, () => makeEntry({ status: 'error' })),
      ...Array.from({ length: 5 }, () => makeEntry({ status: 'ok' })),
    ];
    const result = computeRiskScores(entries, now);
    expect(result.scenarios[0].factors.failureRate).toBeGreaterThan(0);
  });

  it('increases risk with duration volatility', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const stable = computeRiskScores(
      Array.from({ length: 10 }, () => makeEntry({ durationSeconds: 5 })),
      now,
    );
    const volatile = computeRiskScores(
      [
        ...Array.from({ length: 5 }, () => makeEntry({ durationSeconds: 2 })),
        ...Array.from({ length: 5 }, () => makeEntry({ durationSeconds: 20 })),
      ],
      now,
    );
    expect(volatile.scenarios[0].factors.volatility).toBeGreaterThan(
      stable.scenarios[0].factors.volatility,
    );
  });

  it('increases risk with staleness', () => {
    const now = new Date('2026-04-20T10:00:00.000Z');
    const recent = computeRiskScores(
      [makeEntry({ timestamp: '2026-04-20T08:00:00.000Z' })],
      now,
    );
    const stale = computeRiskScores(
      [makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' })],
      now,
    );
    expect(stale.scenarios[0].factors.staleness).toBeGreaterThan(
      recent.scenarios[0].factors.staleness,
    );
  });

  it('increases risk with recent failures', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-09T10:00:00.000Z', status: 'ok' }),
    ];
    const result = computeRiskScores(entries, now);
    expect(result.scenarios[0].factors.recentFailures).toBeGreaterThan(0);
  });

  it('sorts by risk descending', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'safe', status: 'ok' }),
      makeEntry({ scenario: 'risky', status: 'error' }),
      makeEntry({ scenario: 'risky', status: 'error' }),
    ];
    const result = computeRiskScores(entries, now);
    expect(result.scenarios[0].name).toBe('risky');
  });

  it('computes average risk', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'a', status: 'ok' }),
      makeEntry({ scenario: 'b', status: 'ok' }),
    ];
    const result = computeRiskScores(entries, now);
    expect(result.averageRisk).toBeGreaterThanOrEqual(0);
  });

  it('computes distribution', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [makeEntry({ status: 'ok' })];
    const result = computeRiskScores(entries, now);
    expect(result.distribution.low + result.distribution.medium + result.distribution.high + result.distribution.critical).toBe(1);
  });

  it('caps risk at 100', () => {
    const now = new Date('2026-04-20T10:00:00.000Z');
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({
        timestamp: '2026-03-01T10:00:00.000Z',
        status: 'error',
        durationSeconds: i * 10,
      }),
    );
    const result = computeRiskScores(entries, now);
    expect(result.scenarios[0].riskScore).toBeLessThanOrEqual(100);
  });

  it('classifies risk levels correctly', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    // Low risk
    const lowEntries = Array.from({ length: 10 }, () => makeEntry({ status: 'ok' }));
    const low = computeRiskScores(lowEntries, now);
    expect(low.scenarios[0].riskLevel).toBe('low');
  });

  it('handles single entry', () => {
    const result = computeRiskScores([makeEntry()]);
    expect(result.totalScenarios).toBe(1);
    expect(result.scenarios.length).toBe(1);
  });

  it('counts high risk scenarios', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'failing', status: 'error' })),
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'healthy', status: 'ok' })),
    ];
    const result = computeRiskScores(entries, now);
    expect(result.highRiskCount).toBeGreaterThanOrEqual(1);
  });

  it('includes duration std dev', () => {
    const entries = [
      makeEntry({ durationSeconds: 2 }),
      makeEntry({ durationSeconds: 8 }),
    ];
    const result = computeRiskScores(entries);
    expect(result.scenarios[0].durationStdDev).toBeGreaterThan(0);
  });
});

describe('formatRiskScores', () => {
  it('formats empty result', () => {
    const result = computeRiskScores([]);
    const text = formatRiskScores(result);
    expect(text).toContain('Scenario Risk Scores');
    expect(text).toContain('No scenarios');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ scenario: 'demo', status: 'ok' }),
      makeEntry({ scenario: 'test', status: 'error' }),
    ];
    const result = computeRiskScores(entries);
    const text = formatRiskScores(result);
    expect(text).toContain('Average risk');
    expect(text).toContain('Distribution');
    expect(text).toContain('Risk per scenario');
  });

  it('shows risk icons', () => {
    const entries = [makeEntry()];
    const result = computeRiskScores(entries);
    const text = formatRiskScores(result);
    expect(text).toMatch(/🟢|🟡|🟠|🔴/);
  });

  it('shows factor breakdown', () => {
    const entries = [makeEntry()];
    const result = computeRiskScores(entries);
    const text = formatRiskScores(result);
    expect(text).toContain('fail=');
    expect(text).toContain('vol=');
    expect(text).toContain('stale=');
    expect(text).toContain('recent=');
  });
});
