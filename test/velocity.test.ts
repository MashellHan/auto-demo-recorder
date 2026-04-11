import { describe, it, expect } from 'vitest';
import { analyzeVelocity, formatVelocity } from '../src/analytics/velocity.js';
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

describe('analyzeVelocity', () => {
  it('returns empty for no entries', () => {
    const result = analyzeVelocity([]);
    expect(result.windows).toEqual([]);
    expect(result.allTimePerDay).toBe(0);
    expect(result.totalRecordings).toBe(0);
    expect(result.acceleration).toBe('steady');
  });

  it('computes all-time per day', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeVelocity(entries, now);
    expect(result.allTimePerDay).toBeGreaterThan(0);
    expect(result.totalDays).toBeGreaterThanOrEqual(1);
  });

  it('computes rolling windows', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-05T10:00:00.000Z' }),
    ];
    const result = analyzeVelocity(entries, now);
    expect(result.windows.length).toBe(4);
    expect(result.windows[0].label).toBe('1d');
    expect(result.windows[1].label).toBe('7d');
  });

  it('counts entries in each window correctly', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
    ];
    const result = analyzeVelocity(entries, now);
    const w1d = result.windows.find((w) => w.label === '1d')!;
    const w30d = result.windows.find((w) => w.label === '30d')!;
    expect(w1d.count).toBe(2);
    expect(w30d.count).toBe(3);
  });

  it('computes per-day rate for each window', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-${(11 - i).toString().padStart(2, '0')}T10:00:00.000Z` }),
    );
    const result = analyzeVelocity(entries, now);
    const w7d = result.windows.find((w) => w.label === '7d')!;
    expect(w7d.perDay).toBe(1);
  });

  it('computes projections from 7d rate', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 14 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-${(11 - (i % 7)).toString().padStart(2, '0')}T${10 + Math.floor(i / 7)}:00:00.000Z` }),
    );
    const result = analyzeVelocity(entries, now);
    expect(result.projected7d).toBeGreaterThan(0);
    expect(result.projected30d).toBeGreaterThan(result.projected7d);
  });

  it('detects speeding up', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // Recent week: 5/day
    for (let d = 0; d < 7; d++) {
      for (let i = 0; i < 5; i++) {
        const day = new Date(now);
        day.setUTCDate(day.getUTCDate() - d);
        entries.push(makeEntry({
          timestamp: `${day.toISOString().slice(0, 10)}T${10 + i}:00:00.000Z`,
        }));
      }
    }
    // Older 23 days: 1/day
    for (let d = 7; d < 30; d++) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - d);
      entries.push(makeEntry({
        timestamp: `${day.toISOString().slice(0, 10)}T10:00:00.000Z`,
      }));
    }
    const result = analyzeVelocity(entries, now);
    expect(result.acceleration).toBe('speeding-up');
  });

  it('detects slowing down', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // Recent week: 1/day
    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - d);
      entries.push(makeEntry({
        timestamp: `${day.toISOString().slice(0, 10)}T10:00:00.000Z`,
      }));
    }
    // Older 23 days: 5/day
    for (let d = 7; d < 30; d++) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - d);
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({
          timestamp: `${day.toISOString().slice(0, 10)}T${10 + i}:00:00.000Z`,
        }));
      }
    }
    const result = analyzeVelocity(entries, now);
    expect(result.acceleration).toBe('slowing-down');
  });

  it('finds peak day', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T12:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeVelocity(entries);
    expect(result.peakDailyOutput).toBe(3);
    expect(result.peakDay).toBe('2026-04-10');
  });

  it('handles single entry', () => {
    const result = analyzeVelocity([makeEntry()]);
    expect(result.totalRecordings).toBe(1);
    expect(result.totalDays).toBeGreaterThanOrEqual(1);
  });

  it('computes success count per window', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', status: 'error' }),
    ];
    const result = analyzeVelocity(entries, now);
    const w1d = result.windows.find((w) => w.label === '1d')!;
    expect(w1d.successCount).toBe(1);
  });

  it('computes average duration per window', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', durationSeconds: 4 }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', durationSeconds: 6 }),
    ];
    const result = analyzeVelocity(entries, now);
    const w1d = result.windows.find((w) => w.label === '1d')!;
    expect(w1d.avgDuration).toBe(5);
  });
});

describe('formatVelocity', () => {
  it('formats empty result', () => {
    const result = analyzeVelocity([]);
    const text = formatVelocity(result);
    expect(text).toContain('Recording Velocity');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeVelocity(entries);
    const text = formatVelocity(result);
    expect(text).toContain('Total recordings');
    expect(text).toContain('All-time rate');
    expect(text).toContain('Acceleration');
    expect(text).toContain('Rolling windows');
    expect(text).toContain('Projections');
  });

  it('shows acceleration icon', () => {
    const entries = Array.from({ length: 10 }, () => makeEntry());
    const result = analyzeVelocity(entries);
    const text = formatVelocity(result);
    expect(text).toMatch(/🚀|➡️|🐢/);
  });

  it('shows peak day', () => {
    const entries = [makeEntry()];
    const result = analyzeVelocity(entries);
    const text = formatVelocity(result);
    expect(text).toContain('Peak day');
  });
});
