import { describe, it, expect } from 'vitest';
import { computeCoverage, formatCoverage } from '../src/analytics/coverage.js';
import type { HistoryEntry } from '../src/analytics/history.js';

const NOW = new Date('2026-04-11T12:00:00.000Z');

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

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('computeCoverage', () => {
  it('marks recent recordings as covered', () => {
    const scenarios = ['basic'];
    const entries = [makeEntry({ scenario: 'basic', timestamp: daysAgo(1) })];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.scenarios[0].status).toBe('covered');
    expect(result.coveragePercent).toBe(100);
  });

  it('marks old recordings as stale', () => {
    const scenarios = ['basic'];
    const entries = [makeEntry({ scenario: 'basic', timestamp: daysAgo(10) })];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.scenarios[0].status).toBe('stale');
  });

  it('marks unrecorded scenarios as never-recorded', () => {
    const scenarios = ['missing'];
    const result = computeCoverage(scenarios, [], 7, NOW);
    expect(result.scenarios[0].status).toBe('never-recorded');
    expect(result.scenarios[0].recordingCount).toBe(0);
  });

  it('computes correct coverage percentage', () => {
    const scenarios = ['a', 'b', 'c', 'd'];
    const entries = [
      makeEntry({ scenario: 'a', timestamp: daysAgo(1) }),
      makeEntry({ scenario: 'b', timestamp: daysAgo(1) }),
    ];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.coveragePercent).toBe(50);
    expect(result.summary.covered).toBe(2);
    expect(result.summary.neverRecorded).toBe(2);
  });

  it('uses most recent recording for staleness', () => {
    const scenarios = ['basic'];
    const entries = [
      makeEntry({ scenario: 'basic', timestamp: daysAgo(20) }),
      makeEntry({ scenario: 'basic', timestamp: daysAgo(1) }),
    ];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.scenarios[0].status).toBe('covered');
    expect(result.scenarios[0].recordingCount).toBe(2);
  });

  it('computes success rate', () => {
    const scenarios = ['basic'];
    const entries = [
      makeEntry({ scenario: 'basic', status: 'ok', timestamp: daysAgo(1) }),
      makeEntry({ scenario: 'basic', status: 'error', timestamp: daysAgo(1) }),
    ];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.scenarios[0].successRate).toBe(0.5);
  });

  it('sorts by status priority', () => {
    const scenarios = ['covered-one', 'stale-one', 'missing-one'];
    const entries = [
      makeEntry({ scenario: 'covered-one', timestamp: daysAgo(1) }),
      makeEntry({ scenario: 'stale-one', timestamp: daysAgo(10) }),
    ];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.scenarios[0].status).toBe('never-recorded');
    expect(result.scenarios[1].status).toBe('stale');
    expect(result.scenarios[2].status).toBe('covered');
  });

  it('respects custom stale days', () => {
    const scenarios = ['basic'];
    const entries = [makeEntry({ scenario: 'basic', timestamp: daysAgo(3) })];
    // 2-day window → stale
    expect(computeCoverage(scenarios, entries, 2, NOW).scenarios[0].status).toBe('stale');
    // 5-day window → covered
    expect(computeCoverage(scenarios, entries, 5, NOW).scenarios[0].status).toBe('covered');
  });

  it('handles empty scenarios list', () => {
    const result = computeCoverage([], [], 7, NOW);
    expect(result.scenarios.length).toBe(0);
    expect(result.coveragePercent).toBe(0);
  });

  it('ignores entries for unconfigured scenarios', () => {
    const scenarios = ['a'];
    const entries = [
      makeEntry({ scenario: 'a', timestamp: daysAgo(1) }),
      makeEntry({ scenario: 'unconfigured', timestamp: daysAgo(1) }),
    ];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.scenarios.length).toBe(1);
  });

  it('provides days since recording', () => {
    const scenarios = ['basic'];
    const entries = [makeEntry({ scenario: 'basic', timestamp: daysAgo(3) })];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.scenarios[0].daysSinceRecording).toBeCloseTo(3, 0);
  });

  it('computes summary counts', () => {
    const scenarios = ['a', 'b', 'c'];
    const entries = [
      makeEntry({ scenario: 'a', timestamp: daysAgo(1) }),
      makeEntry({ scenario: 'b', timestamp: daysAgo(14) }),
    ];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    expect(result.summary.total).toBe(3);
    expect(result.summary.covered).toBe(1);
    expect(result.summary.stale).toBe(1);
    expect(result.summary.neverRecorded).toBe(1);
  });
});

describe('formatCoverage', () => {
  it('formats empty report', () => {
    const result = computeCoverage([], [], 7, NOW);
    const text = formatCoverage(result);
    expect(text).toContain('Scenario Coverage Report');
    expect(text).toContain('No scenarios');
  });

  it('formats with data', () => {
    const scenarios = ['a', 'b'];
    const entries = [makeEntry({ scenario: 'a', timestamp: daysAgo(1) })];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    const text = formatCoverage(result);
    expect(text).toContain('Coverage: 50%');
    expect(text).toContain('covered');
    expect(text).toContain('never-recorded');
  });

  it('shows status icons', () => {
    const scenarios = ['a'];
    const entries = [makeEntry({ scenario: 'a', timestamp: daysAgo(1) })];
    const result = computeCoverage(scenarios, entries, 7, NOW);
    const text = formatCoverage(result);
    expect(text).toContain('✓');
  });
});
