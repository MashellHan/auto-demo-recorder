import { describe, it, expect } from 'vitest';
import { computeBurndown, formatBurndown } from '../src/analytics/burndown.js';
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

describe('computeBurndown', () => {
  const start = new Date('2026-04-01T00:00:00.000Z');
  const deadline = new Date('2026-04-10T00:00:00.000Z');

  it('returns no-data for empty entries', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const result = computeBurndown([], 100, start, deadline, now);
    expect(result.hasData).toBe(false);
    expect(result.totalCompleted).toBe(0);
    expect(result.remaining).toBe(100);
  });

  it('computes correct remaining', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const entries = Array.from({ length: 30 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-0${1 + (i % 5)}T10:00:00.000Z` }),
    );
    const result = computeBurndown(entries, 100, start, deadline, now);
    expect(result.totalCompleted).toBe(30);
    expect(result.remaining).toBe(70);
    expect(result.targetReached).toBe(false);
  });

  it('detects target reached', () => {
    const now = new Date('2026-04-05T23:00:00.000Z');
    const entries = Array.from({ length: 100 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-0${1 + (i % 5)}T${(10 + (i % 8)).toString().padStart(2, '0')}:00:00.000Z` }),
    );
    const result = computeBurndown(entries, 100, start, deadline, now);
    expect(result.targetReached).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.onTrack).toBe(true);
  });

  it('computes daily velocity from active days', () => {
    const now = new Date('2026-04-03T23:00:00.000Z');
    const entries = [
      // Day 1: 5 recordings
      ...Array.from({ length: 5 }, (_, i) =>
        makeEntry({ timestamp: `2026-04-01T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      // Day 2: 3 recordings
      ...Array.from({ length: 3 }, (_, i) =>
        makeEntry({ timestamp: `2026-04-02T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
    ];
    const result = computeBurndown(entries, 100, start, deadline, now);
    expect(result.dailyVelocity).toBe(4); // 8 total / 2 active days
  });

  it('projects completion date', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-0${1 + (i % 5)}T10:00:00.000Z` }),
    );
    const result = computeBurndown(entries, 100, start, deadline, now);
    expect(result.projectedCompletion).not.toBe('never');
    expect(result.projectedCompletion).not.toBe('reached');
  });

  it('returns never when velocity is zero', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const result = computeBurndown([], 100, start, deadline, now);
    expect(result.projectedCompletion).toBe('never');
    expect(result.onTrack).toBe(false);
  });

  it('determines on-track status correctly', () => {
    const now = new Date('2026-04-02T12:00:00.000Z');
    // 50 recordings in 1 day with 9-day deadline → 50/day velocity, need 100 total → 1 more day
    const entries = Array.from({ length: 50 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-01T${(10 + (i % 12)).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00.000Z` }),
    );
    const result = computeBurndown(entries, 100, start, deadline, now);
    expect(result.onTrack).toBe(true);
  });

  it('excludes entries outside sprint window', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-03T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-03-15T10:00:00.000Z' }), // before sprint
    ];
    const result = computeBurndown(entries, 100, start, deadline, now);
    expect(result.totalCompleted).toBe(1);
  });

  it('builds daily data points', () => {
    const now = new Date('2026-04-03T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-02T10:00:00.000Z' }),
    ];
    const result = computeBurndown(entries, 50, start, deadline, now);
    expect(result.days.length).toBeGreaterThanOrEqual(3);
    // First day should have 1 completed
    expect(result.days[0]!.dailyCount).toBe(1);
    expect(result.days[0]!.completed).toBe(1);
  });

  it('ideal remaining decreases linearly', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' })];
    const result = computeBurndown(entries, 100, start, deadline, now);
    // Ideal should decrease from target to 0 over sprintDays
    expect(result.days[0]!.idealRemaining).toBe(100);
    for (let i = 1; i < result.days.length; i++) {
      expect(result.days[i]!.idealRemaining).toBeLessThanOrEqual(result.days[i - 1]!.idealRemaining);
    }
  });

  it('remaining never goes below 0', () => {
    const now = new Date('2026-04-03T12:00:00.000Z');
    const entries = Array.from({ length: 200 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-01T${(10 + (i % 12)).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00.000Z` }),
    );
    const result = computeBurndown(entries, 50, start, deadline, now);
    for (const d of result.days) {
      expect(d.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('computes correct sprint days', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const result = computeBurndown([], 100, start, deadline, now);
    expect(result.sprintDays).toBe(9);
  });

  it('computes days elapsed', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const result = computeBurndown([], 100, start, deadline, now);
    expect(result.daysElapsed).toBe(5);
  });

  it('sets correct start and deadline in result', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const result = computeBurndown([], 100, start, deadline, now);
    expect(result.startDate).toBe('2026-04-01');
    expect(result.deadline).toBe('2026-04-10');
  });
});

describe('formatBurndown', () => {
  const start = new Date('2026-04-01T00:00:00.000Z');
  const deadline = new Date('2026-04-10T00:00:00.000Z');

  it('formats no-data result', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const result = computeBurndown([], 100, start, deadline, now);
    const text = formatBurndown(result);
    expect(text).toContain('Burndown');
    expect(text).toContain('No recordings');
  });

  it('formats result with data', () => {
    const now = new Date('2026-04-05T12:00:00.000Z');
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-0${1 + (i % 5)}T10:00:00.000Z` }),
    );
    const result = computeBurndown(entries, 100, start, deadline, now);
    const text = formatBurndown(result);
    expect(text).toContain('Burndown');
    expect(text).toContain('Target');
    expect(text).toContain('Remaining');
    expect(text).toContain('Completed');
  });

  it('shows on-track status', () => {
    const now = new Date('2026-04-02T12:00:00.000Z');
    const entries = Array.from({ length: 50 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-01T${(10 + (i % 12)).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00.000Z` }),
    );
    const result = computeBurndown(entries, 100, start, deadline, now);
    const text = formatBurndown(result);
    expect(text).toContain('On track');
  });

  it('shows behind schedule status', () => {
    const now = new Date('2026-04-09T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
    ];
    const result = computeBurndown(entries, 1000, start, deadline, now);
    const text = formatBurndown(result);
    expect(text).toContain('Behind schedule');
  });

  it('shows target reached status', () => {
    const now = new Date('2026-04-03T12:00:00.000Z');
    const entries = Array.from({ length: 100 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-01T${(10 + (i % 12)).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00.000Z` }),
    );
    const result = computeBurndown(entries, 50, start, deadline, now);
    const text = formatBurndown(result);
    expect(text).toContain('Target reached');
  });
});
