import { describe, it, expect } from 'vitest';
import { computeHealthDashboard, formatHealthDashboard } from '../src/analytics/health-dashboard.js';
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

describe('computeHealthDashboard', () => {
  it('returns critical for no entries', () => {
    const result = computeHealthDashboard([]);
    expect(result.grade).toBe('critical');
    expect(result.score).toBe(0);
    expect(result.totalRecordings).toBe(0);
    expect(result.scenarios).toEqual([]);
  });

  it('computes success rate', () => {
    const entries = [
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'error' }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.successRate).toBeCloseTo(66.67, 1);
    expect(result.totalRecordings).toBe(3);
  });

  it('computes average duration', () => {
    const entries = [
      makeEntry({ durationSeconds: 4 }),
      makeEntry({ durationSeconds: 6 }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.avgDuration).toBe(5);
  });

  it('identifies failing scenarios', () => {
    const entries = [
      makeEntry({ scenario: 'good', status: 'ok' }),
      makeEntry({ scenario: 'bad', status: 'error' }),
      makeEntry({ scenario: 'bad', status: 'error' }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.failingScenarios).toContain('bad');
    expect(result.failingScenarios).not.toContain('good');
  });

  it('counts unique scenarios', () => {
    const entries = [
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
      makeEntry({ scenario: 'a' }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.scenarioCount).toBe(2);
  });

  it('computes days since last recording', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
    ];
    const now = new Date('2026-04-12T10:00:00.000Z');
    const result = computeHealthDashboard(entries, now);
    expect(result.daysSinceLastRecording).toBe(2);
  });

  it('returns 0 for today recordings', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = computeHealthDashboard(entries, now);
    expect(result.daysSinceLastRecording).toBe(0);
  });

  it('detects improving trend', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-02T10:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-03T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-04T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-05T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-06T10:00:00.000Z', status: 'ok' }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.trend).toBe('improving');
  });

  it('detects degrading trend', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-02T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-03T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-04T10:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-05T10:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-06T10:00:00.000Z', status: 'error' }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.trend).toBe('degrading');
  });

  it('detects stable trend', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-02T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-03T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-04T10:00:00.000Z', status: 'ok' }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.trend).toBe('stable');
  });

  it('returns stable for fewer than 4 entries', () => {
    const result = computeHealthDashboard([makeEntry(), makeEntry()]);
    expect(result.trend).toBe('stable');
  });

  it('grades excellent for high success rate and recent recordings', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-11T${10 + (i % 4)}:00:00.000Z`, status: 'ok' }),
    );
    const result = computeHealthDashboard(entries, now);
    expect(result.grade).toBe('excellent');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('penalizes failing scenarios in score', () => {
    const entries = [
      makeEntry({ scenario: 'ok1', status: 'ok' }),
      makeEntry({ scenario: 'fail1', status: 'error' }),
      makeEntry({ scenario: 'fail2', status: 'error' }),
      makeEntry({ scenario: 'fail3', status: 'error' }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.score).toBeLessThan(60);
  });

  it('sorts scenarios by success rate ascending', () => {
    const entries = [
      makeEntry({ scenario: 'good', status: 'ok' }),
      makeEntry({ scenario: 'good', status: 'ok' }),
      makeEntry({ scenario: 'bad', status: 'error' }),
      makeEntry({ scenario: 'bad', status: 'error' }),
      makeEntry({ scenario: 'mid', status: 'ok' }),
      makeEntry({ scenario: 'mid', status: 'error' }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.scenarios[0].name).toBe('bad');
    expect(result.scenarios[result.scenarios.length - 1].name).toBe('good');
  });

  it('includes per-scenario health details', () => {
    const entries = [
      makeEntry({ scenario: 'demo', status: 'ok', durationSeconds: 3 }),
      makeEntry({ scenario: 'demo', status: 'ok', durationSeconds: 5 }),
    ];
    const result = computeHealthDashboard(entries);
    expect(result.scenarios.length).toBe(1);
    expect(result.scenarios[0].name).toBe('demo');
    expect(result.scenarios[0].count).toBe(2);
    expect(result.scenarios[0].successRate).toBe(100);
    expect(result.scenarios[0].avgDuration).toBe(4);
    expect(result.scenarios[0].lastStatus).toBe('ok');
    expect(result.scenarios[0].grade).toBe('excellent');
  });

  it('handles single entry', () => {
    const result = computeHealthDashboard([makeEntry()]);
    expect(result.totalRecordings).toBe(1);
    expect(result.scenarioCount).toBe(1);
    expect(result.successRate).toBe(100);
  });
});

describe('formatHealthDashboard', () => {
  it('formats empty dashboard', () => {
    const result = computeHealthDashboard([]);
    const text = formatHealthDashboard(result);
    expect(text).toContain('Recording Health Dashboard');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ scenario: 'demo', status: 'ok' }),
      makeEntry({ scenario: 'test', status: 'error' }),
    ];
    const result = computeHealthDashboard(entries);
    const text = formatHealthDashboard(result);
    expect(text).toContain('Overall');
    expect(text).toContain('Success rate');
    expect(text).toContain('Avg duration');
    expect(text).toContain('Trend');
    expect(text).toContain('Per-Scenario Health');
  });

  it('shows failing scenarios section', () => {
    const entries = [
      makeEntry({ scenario: 'broken', status: 'error' }),
    ];
    const result = computeHealthDashboard(entries);
    const text = formatHealthDashboard(result);
    expect(text).toContain('Failing scenarios');
    expect(text).toContain('broken');
  });

  it('shows grade icons', () => {
    const entries = [makeEntry()];
    const result = computeHealthDashboard(entries);
    const text = formatHealthDashboard(result);
    expect(text).toMatch(/🟢|🔵|🟡|🟠|🔴/);
  });

  it('shows trend icon', () => {
    const entries = Array.from({ length: 8 }, () => makeEntry());
    const result = computeHealthDashboard(entries);
    const text = formatHealthDashboard(result);
    expect(text).toMatch(/📈|➡️|📉/);
  });
});
