import { describe, it, expect } from 'vitest';
import { computeHealthScore, formatHealthScore } from '../src/analytics/health-score.js';
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

describe('computeHealthScore', () => {
  it('returns zero score for empty entries', () => {
    const result = computeHealthScore([], 30, new Date('2026-04-11T12:00:00.000Z'));
    expect(result.hasData).toBe(false);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('returns high score for perfect data', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // 10 days of consistent, 100% success, multi-scenario recordings
    for (let d = 0; d < 10; d++) {
      for (const scenario of ['a', 'b', 'c']) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - d);
        date.setUTCHours(10, 0, 0, 0);
        entries.push(makeEntry({ timestamp: date.toISOString(), scenario }));
      }
    }
    const result = computeHealthScore(entries, 30, now);
    expect(result.hasData).toBe(true);
    expect(result.score).toBeGreaterThan(80);
    expect(result.grade).toSatisfy((g: string) => g === 'A' || g === 'B');
  });

  it('has 5 dimensions', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = computeHealthScore(entries, 30, now);
    expect(result.dimensions.length).toBe(5);
    expect(result.dimensions.map((d) => d.name)).toEqual([
      'Success Rate', 'Coverage', 'Freshness', 'Consistency', 'Volume',
    ]);
  });

  it('weights sum to 1.0', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = computeHealthScore(entries, 30, now);
    const totalWeight = result.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it('composite score equals sum of contributions', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z', status: 'error' }),
    ];
    const result = computeHealthScore(entries, 30, now);
    const sumContrib = result.dimensions.reduce((s, d) => s + d.contribution, 0);
    expect(result.score).toBeCloseTo(sumContrib, 1);
  });

  it('success rate dimension reflects actual rate', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z', status: 'error' }),
    ];
    const result = computeHealthScore(entries, 30, now);
    const successDim = result.dimensions.find((d) => d.name === 'Success Rate');
    expect(successDim!.score).toBe(50);
  });

  it('coverage dimension measures scenario coverage', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z', scenario: 'b' }),
      makeEntry({ timestamp: '2026-03-01T10:00:00.000Z', scenario: 'c' }),
    ];
    const result = computeHealthScore(entries, 30, now);
    const coverageDim = result.dimensions.find((d) => d.name === 'Coverage');
    // 2 active in window / 3 total = 66.67%
    expect(coverageDim!.score).toBeCloseTo(66.67, 0);
  });

  it('freshness dimension is high when recordings are recent', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = computeHealthScore(entries, 30, now);
    const freshDim = result.dimensions.find((d) => d.name === 'Freshness');
    expect(freshDim!.score).toBeGreaterThan(90);
  });

  it('consistency dimension is 100 with single day', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z' }),
    ];
    const result = computeHealthScore(entries, 30, now);
    const consDim = result.dimensions.find((d) => d.name === 'Consistency');
    expect(consDim!.score).toBe(100);
  });

  it('grades correctly', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    // Create perfect data for grade A
    const entries: HistoryEntry[] = [];
    for (let d = 0; d < 15; d++) {
      for (const scenario of ['a', 'b', 'c', 'd']) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - d);
        date.setUTCHours(10, 0, 0, 0);
        entries.push(makeEntry({ timestamp: date.toISOString(), scenario }));
      }
    }
    const result = computeHealthScore(entries, 30, now);
    expect(result.grade).toBe('A');
  });

  it('all dimension scores are between 0 and 100', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z', status: 'error' }),
    ];
    const result = computeHealthScore(entries, 30, now);
    for (const d of result.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it('respects window parameter', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-01-01T10:00:00.000Z' }),
    ];
    const result = computeHealthScore(entries, 7, now);
    expect(result.totalRecordings).toBe(1);
    expect(result.windowDays).toBe(7);
  });

  it('low success rate lowers overall score', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const allOk = Array.from({ length: 10 }, (_, i) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - i);
      return makeEntry({ timestamp: date.toISOString(), status: 'ok' });
    });
    const halfFail = Array.from({ length: 10 }, (_, i) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - i);
      return makeEntry({ timestamp: date.toISOString(), status: i < 5 ? 'ok' : 'error' });
    });
    const okResult = computeHealthScore(allOk, 30, now);
    const failResult = computeHealthScore(halfFail, 30, now);
    expect(okResult.score).toBeGreaterThan(failResult.score);
  });

  it('volume dimension scores higher with more recordings per day', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const lowVol = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const highVol = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
    );
    const lowResult = computeHealthScore(lowVol, 30, now);
    const highResult = computeHealthScore(highVol, 30, now);
    const lowVolDim = lowResult.dimensions.find((d) => d.name === 'Volume');
    const highVolDim = highResult.dimensions.find((d) => d.name === 'Volume');
    expect(highVolDim!.score).toBeGreaterThan(lowVolDim!.score);
  });
});

describe('formatHealthScore', () => {
  it('formats no-data result', () => {
    const result = computeHealthScore([], 30, new Date('2026-04-11T12:00:00.000Z'));
    const text = formatHealthScore(result);
    expect(text).toContain('Health Score');
    expect(text).toContain('No recording data');
  });

  it('formats result with data', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = computeHealthScore(entries, 30, now);
    const text = formatHealthScore(result);
    expect(text).toContain('Health Score');
    expect(text).toContain('Grade');
    expect(text).toContain('Dimensions');
    expect(text).toContain('Success Rate');
  });

  it('shows score bar', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = computeHealthScore(entries, 30, now);
    const text = formatHealthScore(result);
    expect(text).toContain('█');
  });

  it('shows grade icon', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries: HistoryEntry[] = [];
    for (let d = 0; d < 10; d++) {
      for (const scenario of ['a', 'b', 'c']) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - d);
        date.setUTCHours(10, 0, 0, 0);
        entries.push(makeEntry({ timestamp: date.toISOString(), scenario }));
      }
    }
    const result = computeHealthScore(entries, 30, now);
    const text = formatHealthScore(result);
    expect(text).toContain('/100');
  });
});
