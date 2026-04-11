import { describe, it, expect } from 'vitest';
import { computeFreshness, formatFreshness } from '../src/analytics/freshness.js';
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

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

describe('computeFreshness', () => {
  it('grades recent recordings as fresh', () => {
    const entries = [makeEntry({ scenario: 'basic', timestamp: hoursAgo(2) })];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].grade).toBe('fresh');
    expect(result.scenarios[0].stalenessScore).toBeLessThan(10);
  });

  it('grades 2-day old recordings as recent', () => {
    const entries = [makeEntry({ scenario: 'basic', timestamp: hoursAgo(48) })];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].grade).toBe('recent');
  });

  it('grades 5-day old recordings as aging', () => {
    const entries = [makeEntry({ scenario: 'basic', timestamp: hoursAgo(120) })];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].grade).toBe('aging');
  });

  it('grades 14-day old recordings as stale', () => {
    const entries = [makeEntry({ scenario: 'basic', timestamp: hoursAgo(336) })];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].grade).toBe('stale');
  });

  it('grades 40-day old recordings as expired', () => {
    const entries = [makeEntry({ scenario: 'basic', timestamp: hoursAgo(960) })];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].grade).toBe('expired');
    expect(result.scenarios[0].stalenessScore).toBe(100);
  });

  it('computes correct hours since last recording', () => {
    const entries = [makeEntry({ scenario: 'basic', timestamp: hoursAgo(10) })];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].hoursSinceLastRecording).toBe(10);
  });

  it('uses most recent recording per scenario', () => {
    const entries = [
      makeEntry({ scenario: 'basic', timestamp: hoursAgo(100) }),
      makeEntry({ scenario: 'basic', timestamp: hoursAgo(5) }),
    ];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].hoursSinceLastRecording).toBe(5);
    expect(result.scenarios[0].grade).toBe('fresh');
  });

  it('groups by scenario', () => {
    const entries = [
      makeEntry({ scenario: 'a', timestamp: hoursAgo(2) }),
      makeEntry({ scenario: 'b', timestamp: hoursAgo(200) }),
    ];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios.length).toBe(2);
  });

  it('sorts by staleness descending', () => {
    const entries = [
      makeEntry({ scenario: 'fresh-one', timestamp: hoursAgo(1) }),
      makeEntry({ scenario: 'stale-one', timestamp: hoursAgo(500) }),
    ];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].scenario).toBe('stale-one');
    expect(result.scenarios[1].scenario).toBe('fresh-one');
  });

  it('computes summary counts', () => {
    const entries = [
      makeEntry({ scenario: 'a', timestamp: hoursAgo(1) }),
      makeEntry({ scenario: 'b', timestamp: hoursAgo(48) }),
      makeEntry({ scenario: 'c', timestamp: hoursAgo(200) }),
    ];
    const result = computeFreshness(entries, NOW);
    expect(result.summary.fresh).toBe(1);
    expect(result.summary.recent).toBe(1);
    expect(result.summary.stale).toBe(1);
  });

  it('computes overall freshness score', () => {
    const entries = [
      makeEntry({ scenario: 'a', timestamp: hoursAgo(1) }),
      makeEntry({ scenario: 'b', timestamp: hoursAgo(1) }),
    ];
    const result = computeFreshness(entries, NOW);
    expect(result.overallScore).toBeGreaterThan(90);
  });

  it('computes recordings per day', () => {
    const entries = [
      makeEntry({ scenario: 'basic', timestamp: hoursAgo(48) }),
      makeEntry({ scenario: 'basic', timestamp: hoursAgo(24) }),
      makeEntry({ scenario: 'basic', timestamp: hoursAgo(1) }),
    ];
    const result = computeFreshness(entries, NOW);
    expect(result.scenarios[0].avgRecordingsPerDay).toBeGreaterThan(0);
    expect(result.scenarios[0].totalRecordings).toBe(3);
  });

  it('handles empty input', () => {
    const result = computeFreshness([], NOW);
    expect(result.scenarios.length).toBe(0);
    expect(result.overallScore).toBe(0);
  });
});

describe('formatFreshness', () => {
  it('formats empty results', () => {
    const result = computeFreshness([], NOW);
    const text = formatFreshness(result);
    expect(text).toContain('Recording Freshness Index');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ scenario: 'a', timestamp: hoursAgo(2) }),
      makeEntry({ scenario: 'b', timestamp: hoursAgo(200) }),
    ];
    const result = computeFreshness(entries, NOW);
    const text = formatFreshness(result);
    expect(text).toContain('Overall freshness');
    expect(text).toContain('fresh');
    expect(text).toContain('stale');
  });

  it('shows grade icons', () => {
    const entries = [makeEntry({ scenario: 'a', timestamp: hoursAgo(1) })];
    const result = computeFreshness(entries, NOW);
    const text = formatFreshness(result);
    expect(text).toContain('🟢');
  });
});
