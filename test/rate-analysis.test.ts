import { describe, it, expect } from 'vitest';
import { analyzeRates, formatRateAnalysis } from '../src/analytics/rate-analysis.js';
import type { HistoryEntry } from '../src/analytics/history.js';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-04-10T10:00:00.000Z',
    scenario: 'demo',
    status: 'ok',
    durationSeconds: 5,
    backend: 'vhs',
    outputFile: 'out.gif',
    ...overrides,
  };
}

describe('analyzeRates', () => {
  it('returns empty result for no entries', () => {
    const result = analyzeRates([]);
    expect(result.daily).toEqual([]);
    expect(result.weekly).toEqual([]);
    expect(result.avgPerDay).toBe(0);
    expect(result.avgPerWeek).toBe(0);
    expect(result.peakDay).toBeNull();
    expect(result.peakWeek).toBeNull();
    expect(result.velocityTrend).toBe('stable');
    expect(result.totalRecordings).toBe(0);
    expect(result.totalDays).toBe(0);
  });

  it('groups entries by day', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T14:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    expect(result.daily.length).toBe(2);
    expect(result.daily[0].period).toBe('2026-04-10');
    expect(result.daily[0].count).toBe(2);
    expect(result.daily[1].period).toBe('2026-04-11');
    expect(result.daily[1].count).toBe(1);
  });

  it('groups entries by week', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-06T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-07T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-13T10:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    expect(result.weekly.length).toBeGreaterThanOrEqual(2);
  });

  it('computes average per day', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    expect(result.avgPerDay).toBeGreaterThan(0);
    expect(result.totalRecordings).toBe(3);
  });

  it('computes average per week', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-15T10:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    expect(result.avgPerWeek).toBeGreaterThan(0);
  });

  it('finds peak day', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T12:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    expect(result.peakDay).not.toBeNull();
    expect(result.peakDay!.period).toBe('2026-04-10');
    expect(result.peakDay!.count).toBe(3);
  });

  it('finds peak week', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    expect(result.peakWeek).not.toBeNull();
    expect(result.peakWeek!.count).toBeGreaterThanOrEqual(2);
  });

  it('tracks success counts per period', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-10T12:00:00.000Z', status: 'ok' }),
    ];
    const result = analyzeRates(entries);
    const day = result.daily.find((d) => d.period === '2026-04-10');
    expect(day).toBeDefined();
    expect(day!.successCount).toBe(2);
  });

  it('computes average duration per period', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z', durationSeconds: 4 }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z', durationSeconds: 6 }),
    ];
    const result = analyzeRates(entries);
    const day = result.daily.find((d) => d.period === '2026-04-10');
    expect(day).toBeDefined();
    expect(day!.avgDuration).toBe(5);
  });

  it('detects accelerating velocity', () => {
    // First half: 1 per day, second half: 3 per day
    const entries: HistoryEntry[] = [];
    for (let d = 1; d <= 4; d++) {
      entries.push(makeEntry({ timestamp: `2026-04-0${d}T10:00:00.000Z` }));
    }
    for (let d = 5; d <= 8; d++) {
      for (let i = 0; i < 3; i++) {
        entries.push(makeEntry({ timestamp: `2026-04-0${d}T${10 + i}:00:00.000Z` }));
      }
    }
    const result = analyzeRates(entries);
    expect(result.velocityTrend).toBe('accelerating');
  });

  it('detects decelerating velocity', () => {
    const entries: HistoryEntry[] = [];
    for (let d = 1; d <= 4; d++) {
      for (let i = 0; i < 3; i++) {
        entries.push(makeEntry({ timestamp: `2026-04-0${d}T${10 + i}:00:00.000Z` }));
      }
    }
    for (let d = 5; d <= 8; d++) {
      entries.push(makeEntry({ timestamp: `2026-04-0${d}T10:00:00.000Z` }));
    }
    const result = analyzeRates(entries);
    expect(result.velocityTrend).toBe('decelerating');
  });

  it('detects stable velocity', () => {
    const entries: HistoryEntry[] = [];
    for (let d = 1; d <= 8; d++) {
      entries.push(makeEntry({ timestamp: `2026-04-0${d}T10:00:00.000Z` }));
      entries.push(makeEntry({ timestamp: `2026-04-0${d}T11:00:00.000Z` }));
    }
    const result = analyzeRates(entries);
    expect(result.velocityTrend).toBe('stable');
  });

  it('returns stable for fewer than 4 daily periods', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    expect(result.velocityTrend).toBe('stable');
  });

  it('handles single entry', () => {
    const result = analyzeRates([makeEntry()]);
    expect(result.totalRecordings).toBe(1);
    expect(result.totalDays).toBe(1);
    expect(result.daily.length).toBe(1);
    expect(result.peakDay).not.toBeNull();
  });

  it('sorts daily rates chronologically', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-12T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    expect(result.daily[0].period).toBe('2026-04-10');
    expect(result.daily[1].period).toBe('2026-04-11');
    expect(result.daily[2].period).toBe('2026-04-12');
  });
});

describe('formatRateAnalysis', () => {
  it('formats empty analysis', () => {
    const result = analyzeRates([]);
    const text = formatRateAnalysis(result);
    expect(text).toContain('Recording Rate Analysis');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    const text = formatRateAnalysis(result);
    expect(text).toContain('Total recordings: 3');
    expect(text).toContain('Avg per day');
    expect(text).toContain('Avg per week');
    expect(text).toContain('Velocity');
  });

  it('shows peak day info', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    const text = formatRateAnalysis(result);
    expect(text).toContain('Peak day');
    expect(text).toContain('2026-04-10');
  });

  it('shows daily rate bars', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T12:00:00.000Z' }),
    ];
    const result = analyzeRates(entries);
    const text = formatRateAnalysis(result);
    expect(text).toContain('Daily rates');
    expect(text).toContain('█');
  });

  it('shows velocity trend icon', () => {
    const entries: HistoryEntry[] = [];
    for (let d = 1; d <= 8; d++) {
      entries.push(makeEntry({ timestamp: `2026-04-0${d}T10:00:00.000Z` }));
    }
    const result = analyzeRates(entries);
    const text = formatRateAnalysis(result);
    expect(text).toMatch(/📈|➡️|📉/);
  });
});
