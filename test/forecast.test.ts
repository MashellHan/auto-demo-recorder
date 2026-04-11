import { describe, it, expect } from 'vitest';
import { buildDailyObservations, generateForecast, formatForecast } from '../src/analytics/forecast.js';
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

function makeEntriesForDays(
  days: number,
  countPerDay: number,
  now: Date,
  status: 'ok' | 'error' = 'ok',
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (let d = 0; d < days; d++) {
    for (let i = 0; i < countPerDay; i++) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - d);
      date.setUTCHours(10 + i, 0, 0, 0);
      entries.push(makeEntry({
        timestamp: date.toISOString(),
        status,
      }));
    }
  }
  return entries;
}

describe('buildDailyObservations', () => {
  it('returns empty observations for no entries', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const obs = buildDailyObservations([], now, 3);
    expect(obs.length).toBeGreaterThan(0);
    expect(obs.every((o) => o.count === 0)).toBe(true);
  });

  it('groups entries by date', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
    ];
    const obs = buildDailyObservations(entries, now, 3);
    const apr11 = obs.find((o) => o.date === '2026-04-11');
    const apr10 = obs.find((o) => o.date === '2026-04-10');
    expect(apr11?.count).toBe(2);
    expect(apr10?.count).toBe(1);
  });

  it('fills gaps with zero-count days', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const obs = buildDailyObservations(entries, now, 5);
    const zeroDays = obs.filter((o) => o.count === 0);
    expect(zeroDays.length).toBeGreaterThan(0);
  });

  it('computes success rate per day', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z', status: 'error' }),
    ];
    const obs = buildDailyObservations(entries, now, 3);
    const apr11 = obs.find((o) => o.date === '2026-04-11');
    expect(apr11?.successRate).toBe(50);
  });

  it('excludes entries outside lookback window', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-03-01T10:00:00.000Z' }),
    ];
    const obs = buildDailyObservations(entries, now, 7);
    const totalCount = obs.reduce((s, o) => s + o.count, 0);
    expect(totalCount).toBe(1);
  });
});

describe('generateForecast', () => {
  it('returns no-data result for empty entries', () => {
    const result = generateForecast([], 7, 'ema', 7, 0.3, new Date('2026-04-11T12:00:00.000Z'), 30);
    expect(result.hasEnoughData).toBe(false);
    expect(result.forecast.length).toBe(0);
  });

  it('generates forecast points for the requested number of days', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(7, 3, now);
    const result = generateForecast(entries, 5, 'sma', 7, 0.3, now, 30);
    expect(result.forecast.length).toBe(5);
    expect(result.hasEnoughData).toBe(true);
  });

  it('produces non-negative predicted counts', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(3, 2, now);
    const result = generateForecast(entries, 7, 'ema', 7, 0.3, now, 30);
    for (const pt of result.forecast) {
      expect(pt.predictedCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('predicted success rate is between 0 and 100', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(5, 4, now);
    const result = generateForecast(entries, 7, 'ema', 7, 0.3, now, 30);
    for (const pt of result.forecast) {
      expect(pt.predictedSuccessRate).toBeGreaterThanOrEqual(0);
      expect(pt.predictedSuccessRate).toBeLessThanOrEqual(100);
    }
  });

  it('confidence decreases with distance', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(7, 3, now);
    const result = generateForecast(entries, 7, 'sma', 7, 0.3, now, 30);
    for (let i = 1; i < result.forecast.length; i++) {
      expect(result.forecast[i]!.confidence).toBeLessThanOrEqual(result.forecast[i - 1]!.confidence);
    }
  });

  it('confidence is at least 10%', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(7, 3, now);
    const result = generateForecast(entries, 20, 'sma', 7, 0.3, now, 30);
    for (const pt of result.forecast) {
      expect(pt.confidence).toBeGreaterThanOrEqual(10);
    }
  });

  it('uses SMA method correctly', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(7, 5, now);
    const result = generateForecast(entries, 3, 'sma', 3, 0.3, now, 30);
    expect(result.method).toBe('sma');
    expect(result.forecast.length).toBe(3);
  });

  it('uses EMA method correctly', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(7, 5, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.5, now, 30);
    expect(result.method).toBe('ema');
    expect(result.alpha).toBe(0.5);
  });

  it('detects increasing trend', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    // First 20 days: 1 recording/day
    // Last 7 days: 5 recordings/day — should be increasing
    const entries: HistoryEntry[] = [];
    for (let d = 27; d >= 8; d--) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - d);
      date.setUTCHours(10, 0, 0, 0);
      entries.push(makeEntry({ timestamp: date.toISOString() }));
    }
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - d);
      for (let i = 0; i < 5; i++) {
        const ts = new Date(date);
        ts.setUTCHours(10 + i, 0, 0, 0);
        entries.push(makeEntry({ timestamp: ts.toISOString() }));
      }
    }
    const result = generateForecast(entries, 7, 'sma', 7, 0.3, now, 30);
    expect(result.trend).toBe('increasing');
  });

  it('detects decreasing trend', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    // First 20 days: 5 recordings/day
    // Last 7 days: 1 recording/day — should be decreasing
    const entries: HistoryEntry[] = [];
    for (let d = 27; d >= 8; d--) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - d);
      for (let i = 0; i < 5; i++) {
        const ts = new Date(date);
        ts.setUTCHours(10 + i, 0, 0, 0);
        entries.push(makeEntry({ timestamp: ts.toISOString() }));
      }
    }
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - d);
      date.setUTCHours(10, 0, 0, 0);
      entries.push(makeEntry({ timestamp: date.toISOString() }));
    }
    const result = generateForecast(entries, 7, 'sma', 7, 0.3, now, 30);
    expect(result.trend).toBe('decreasing');
  });

  it('detects stable trend with uniform data', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(14, 3, now);
    const result = generateForecast(entries, 5, 'sma', 7, 0.3, now, 14);
    expect(result.trend).toBe('stable');
  });

  it('computes average daily count from active days only', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    // 3 days with 6 recordings each
    const entries = makeEntriesForDays(3, 6, now);
    const result = generateForecast(entries, 3, 'sma', 7, 0.3, now, 30);
    expect(result.avgDailyCount).toBe(6);
  });

  it('computes average success rate', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z', status: 'error' }),
    ];
    const result = generateForecast(entries, 3, 'sma', 7, 0.3, now, 30);
    expect(result.avgSuccessRate).toBe(50);
  });

  it('forecast dates are sequential and after now', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(5, 3, now);
    const result = generateForecast(entries, 5, 'ema', 7, 0.3, now, 30);
    for (let i = 0; i < result.forecast.length; i++) {
      const forecastDate = new Date(result.forecast[i]!.date);
      expect(forecastDate.getTime()).toBeGreaterThan(now.getTime() - 24 * 60 * 60 * 1000);
      if (i > 0) {
        const prevDate = new Date(result.forecast[i - 1]!.date);
        expect(forecastDate.getTime()).toBeGreaterThan(prevDate.getTime());
      }
    }
  });

  it('EMA predicts high success rate when all recordings are ok (T2210 fix)', () => {
    // Regression test: EMA used to treat zero-data days as real 0% success,
    // producing ~30% instead of ~100% when data was sparse.
    const now = new Date('2026-04-11T23:00:00.000Z');
    // Only 1 recording per day for 1 day in a 30-day lookback window
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
    ];
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    // All recordings are ok, so predicted success rate should be 100%
    expect(result.forecast[0]!.predictedSuccessRate).toBe(100);
  });

  it('SMA predicts high success rate with sparse all-ok data (T2210 fix)', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    // 3 days with 2 ok recordings each, in a 30-day window
    const entries = makeEntriesForDays(3, 2, now, 'ok');
    const result = generateForecast(entries, 3, 'sma', 7, 0.3, now, 30);
    expect(result.forecast[0]!.predictedSuccessRate).toBe(100);
  });

  it('exposes activeDays count in result', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(5, 2, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    expect(result.activeDays).toBe(5);
  });

  it('reports insufficient data quality with 1 active day', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    expect(result.activeDays).toBe(1);
    expect(result.dataQuality).toBe('insufficient');
  });

  it('reports insufficient data quality with 2 active days', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(2, 3, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    expect(result.activeDays).toBe(2);
    expect(result.dataQuality).toBe('insufficient');
  });

  it('reports limited data quality with 3 active days', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(3, 2, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    expect(result.activeDays).toBe(3);
    expect(result.dataQuality).toBe('limited');
  });

  it('reports limited data quality with 6 active days', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(6, 2, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    expect(result.activeDays).toBe(6);
    expect(result.dataQuality).toBe('limited');
  });

  it('reports good data quality with 7+ active days', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(10, 2, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    expect(result.activeDays).toBe(10);
    expect(result.dataQuality).toBe('good');
  });

  it('reports insufficient quality and zero activeDays for no data', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const result = generateForecast([], 7, 'ema', 7, 0.3, now, 30);
    expect(result.activeDays).toBe(0);
    expect(result.dataQuality).toBe('insufficient');
    expect(result.hasEnoughData).toBe(false);
  });

  it('handles mixed success and error entries', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const ok = makeEntriesForDays(5, 3, now, 'ok');
    const err = makeEntriesForDays(5, 1, now, 'error');
    const result = generateForecast([...ok, ...err], 3, 'ema', 7, 0.3, now, 30);
    expect(result.hasEnoughData).toBe(true);
    expect(result.avgSuccessRate).toBeLessThan(100);
    expect(result.avgSuccessRate).toBeGreaterThan(0);
  });

  it('respects lookback window', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = [
      ...makeEntriesForDays(3, 5, now),
      makeEntry({ timestamp: '2026-01-01T10:00:00.000Z' }),
    ];
    const result = generateForecast(entries, 3, 'sma', 7, 0.3, now, 7);
    expect(result.historicalDays).toBe(7);
    // Old entry should be excluded, 3 days × 5 = 15
    const totalObserved = result.observations.reduce((s, o) => s + o.count, 0);
    expect(totalObserved).toBe(15);
  });
});

describe('formatForecast', () => {
  it('formats no-data result', () => {
    const result = generateForecast([], 7, 'ema', 7, 0.3, new Date('2026-04-11T12:00:00.000Z'), 30);
    const text = formatForecast(result);
    expect(text).toContain('Forecast');
    expect(text).toContain('No recording data');
  });

  it('formats forecast with data', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(7, 3, now);
    const result = generateForecast(entries, 5, 'ema', 7, 0.3, now, 30);
    const text = formatForecast(result);
    expect(text).toContain('Forecast');
    expect(text).toContain('Exponential Smoothing');
    expect(text).toContain('Confidence');
    expect(text).toContain('Recent activity');
  });

  it('formats SMA method label', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = makeEntriesForDays(7, 3, now);
    const result = generateForecast(entries, 3, 'sma', 5, 0.3, now, 30);
    const text = formatForecast(result);
    expect(text).toContain('Simple Moving Average');
    expect(text).toContain('window=5');
  });

  it('shows trend icon', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(14, 3, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 14);
    const text = formatForecast(result);
    expect(text).toContain('stable');
  });

  it('shows insufficient data warning with 1 active day', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    const text = formatForecast(result);
    expect(text).toContain('Insufficient historical data');
    expect(text).toContain('1 active day');
    expect(text).toContain('At least 3 days');
  });

  it('shows limited data warning with 4 active days', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(4, 2, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 30);
    const text = formatForecast(result);
    expect(text).toContain('Limited historical data');
    expect(text).toContain('4 active days');
  });

  it('shows no warning with 7+ active days', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = makeEntriesForDays(10, 3, now);
    const result = generateForecast(entries, 3, 'ema', 7, 0.3, now, 10);
    const text = formatForecast(result);
    expect(text).not.toContain('Insufficient');
    expect(text).not.toContain('Limited');
  });
});
