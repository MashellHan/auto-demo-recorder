import { describe, it, expect } from 'vitest';
import { analyzeStreaks, formatStreaks } from '../src/analytics/streaks.js';
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

describe('analyzeStreaks', () => {
  it('returns empty for no entries', () => {
    const result = analyzeStreaks([]);
    expect(result.currentStreak).toBeNull();
    expect(result.longestStreak).toBeNull();
    expect(result.streaks).toEqual([]);
    expect(result.totalActiveDays).toBe(0);
    expect(result.isActive).toBe(false);
  });

  it('computes single-day streak', () => {
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = analyzeStreaks(entries);
    expect(result.streaks.length).toBe(1);
    expect(result.streaks[0].days).toBe(1);
    expect(result.currentStreak?.days).toBe(1);
  });

  it('computes multi-day consecutive streak', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    expect(result.streaks.length).toBe(1);
    expect(result.streaks[0].days).toBe(3);
    expect(result.streaks[0].recordings).toBe(3);
  });

  it('detects breaks between streaks', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-02T10:00:00.000Z' }),
      // Gap on Apr 3
      makeEntry({ timestamp: '2026-04-04T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-05T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    expect(result.streaks.length).toBe(2);
    expect(result.streaks[0].days).toBe(2);
    expect(result.streaks[1].days).toBe(2);
  });

  it('finds longest streak', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
      // Gap
      makeEntry({ timestamp: '2026-04-05T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-06T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    expect(result.longestStreak?.days).toBe(3);
    expect(result.longestStreak?.startDate).toBe('2026-04-05');
  });

  it('counts multiple recordings on same day', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T12:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    expect(result.totalActiveDays).toBe(1);
    expect(result.streaks[0].recordings).toBe(3);
    expect(result.avgRecordingsPerDay).toBe(3);
  });

  it('detects active streak when including today', () => {
    const now = new Date('2026-04-11T15:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries, now);
    expect(result.isActive).toBe(true);
  });

  it('detects active streak when yesterday was last day', () => {
    const now = new Date('2026-04-12T08:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries, now);
    expect(result.isActive).toBe(true);
  });

  it('detects inactive streak when gap is more than 1 day', () => {
    const now = new Date('2026-04-14T10:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries, now);
    expect(result.isActive).toBe(false);
  });

  it('computes active day percentage', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-03T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-05T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    expect(result.totalActiveDays).toBe(3);
    expect(result.totalSpan).toBe(5);
    expect(result.activeDayPct).toBe(60);
  });

  it('computes total span correctly', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    expect(result.totalSpan).toBe(10);
  });

  it('handles single day span', () => {
    const entries = [makeEntry()];
    const result = analyzeStreaks(entries);
    expect(result.totalSpan).toBe(1);
    expect(result.activeDayPct).toBe(100);
  });

  it('current streak is always the last streak', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-02T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-03T10:00:00.000Z' }),
      // Gap
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    expect(result.currentStreak?.startDate).toBe('2026-04-10');
    expect(result.currentStreak?.days).toBe(1);
  });

  it('orders streaks chronologically', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-05T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    expect(result.streaks.length).toBe(3);
    expect(result.streaks[0].startDate).toBe('2026-04-01');
    expect(result.streaks[2].startDate).toBe('2026-04-10');
  });
});

describe('formatStreaks', () => {
  it('formats empty result', () => {
    const result = analyzeStreaks([]);
    const text = formatStreaks(result);
    expect(text).toContain('Recording Streaks');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const now = new Date('2026-04-11T12:00:00.000Z');
    const result = analyzeStreaks(entries, now);
    const text = formatStreaks(result);
    expect(text).toContain('Current streak');
    expect(text).toContain('Longest streak');
    expect(text).toContain('Active days');
    expect(text).toContain('🔥');
  });

  it('shows inactive icon when not active', () => {
    const entries = [makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' })];
    const now = new Date('2026-04-11T10:00:00.000Z');
    const result = analyzeStreaks(entries, now);
    const text = formatStreaks(result);
    expect(text).toContain('💤');
  });

  it('shows streak history bars', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeStreaks(entries);
    const text = formatStreaks(result);
    expect(text).toContain('Streak history');
    expect(text).toContain('█');
  });
});
