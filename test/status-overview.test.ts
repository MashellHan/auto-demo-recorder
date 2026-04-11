import { describe, it, expect } from 'vitest';
import { computeStatusOverview, formatStatusOverview } from '../src/analytics/status-overview.js';
import type { HistoryEntry } from '../src/analytics/history.js';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-04-11T10:00:00.000Z',
    sessionId: '2026-04-11_10-00',
    scenario: 'basic',
    status: 'ok',
    durationSeconds: 12.5,
    bugsFound: 0,
    backend: 'vhs',
    ...overrides,
  };
}

describe('computeStatusOverview', () => {
  it('handles empty entries', () => {
    const result = computeStatusOverview([]);
    expect(result.totalScenarios).toBe(0);
    expect(result.healthyCount).toBe(0);
    expect(result.failingCount).toBe(0);
  });

  it('groups by scenario', () => {
    const entries = [
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
    ];
    const result = computeStatusOverview(entries);
    expect(result.totalScenarios).toBe(2);
    expect(result.scenarios.find((s) => s.name === 'a')!.totalRuns).toBe(2);
    expect(result.scenarios.find((s) => s.name === 'b')!.totalRuns).toBe(1);
  });

  it('calculates success rate', () => {
    const entries = [
      makeEntry({ scenario: 'test', status: 'ok' }),
      makeEntry({ scenario: 'test', status: 'ok' }),
      makeEntry({ scenario: 'test', status: 'error' }),
    ];
    const result = computeStatusOverview(entries);
    const s = result.scenarios.find((s) => s.name === 'test')!;
    expect(s.successRate).toBe(67);
    expect(s.successCount).toBe(2);
  });

  it('uses latest status', () => {
    const entries = [
      makeEntry({ scenario: 'test', status: 'ok', timestamp: '2026-04-11T10:00:00Z' }),
      makeEntry({ scenario: 'test', status: 'error', timestamp: '2026-04-11T11:00:00Z' }),
    ];
    const result = computeStatusOverview(entries);
    expect(result.scenarios[0].latestStatus).toBe('error');
  });

  it('counts healthy and failing', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'ok' }),
      makeEntry({ scenario: 'b', status: 'error' }),
      makeEntry({ scenario: 'c', status: 'warning' }),
    ];
    const result = computeStatusOverview(entries);
    expect(result.healthyCount).toBe(1);
    expect(result.failingCount).toBe(1);
  });

  it('calculates average duration', () => {
    const entries = [
      makeEntry({ scenario: 'test', durationSeconds: 10 }),
      makeEntry({ scenario: 'test', durationSeconds: 20 }),
    ];
    const result = computeStatusOverview(entries);
    expect(result.scenarios[0].avgDuration).toBe(15);
  });

  it('sums bugs', () => {
    const entries = [
      makeEntry({ scenario: 'test', bugsFound: 2 }),
      makeEntry({ scenario: 'test', bugsFound: 3 }),
    ];
    const result = computeStatusOverview(entries);
    expect(result.scenarios[0].totalBugs).toBe(5);
  });

  it('sorts scenarios by name', () => {
    const entries = [
      makeEntry({ scenario: 'zeta' }),
      makeEntry({ scenario: 'alpha' }),
      makeEntry({ scenario: 'beta' }),
    ];
    const result = computeStatusOverview(entries);
    expect(result.scenarios[0].name).toBe('alpha');
    expect(result.scenarios[2].name).toBe('zeta');
  });
});

describe('formatStatusOverview', () => {
  it('formats empty overview', () => {
    const result = computeStatusOverview([]);
    const text = formatStatusOverview(result);
    expect(text).toContain('No recording history');
  });

  it('formats overview with data', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'ok' }),
      makeEntry({ scenario: 'b', status: 'error' }),
    ];
    const result = computeStatusOverview(entries);
    const text = formatStatusOverview(result);
    expect(text).toContain('Scenario Status Overview');
    expect(text).toContain('Health:');
    expect(text).toContain('Failing:');
  });

  it('shows status icons', () => {
    const entries = [
      makeEntry({ scenario: 'passing', status: 'ok' }),
      makeEntry({ scenario: 'failing', status: 'error' }),
    ];
    const result = computeStatusOverview(entries);
    const text = formatStatusOverview(result);
    expect(text).toContain('✓');
    expect(text).toContain('✗');
  });
});
