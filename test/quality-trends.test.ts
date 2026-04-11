import { describe, it, expect } from 'vitest';
import { analyzeQualityTrends, formatQualityTrends } from '../src/analytics/quality-trends.js';
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

describe('analyzeQualityTrends', () => {
  it('returns empty for no entries', () => {
    const result = analyzeQualityTrends([]);
    expect(result.snapshots).toEqual([]);
    expect(result.dimensions).toEqual([]);
    expect(result.overall).toBe('stable');
    expect(result.totalRecordings).toBe(0);
  });

  it('builds snapshots from time windows', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-05T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-03-28T10:00:00.000Z' }),
    ];
    const result = analyzeQualityTrends(entries, 7, 8, now);
    expect(result.snapshots.length).toBeGreaterThanOrEqual(2);
    expect(result.windowDays).toBe(7);
  });

  it('computes success rate per window', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', status: 'error' }),
    ];
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const latest = result.snapshots[result.snapshots.length - 1];
    expect(latest.successRate).toBe(50);
  });

  it('computes avg duration per window', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', durationSeconds: 4 }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', durationSeconds: 6 }),
    ];
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const latest = result.snapshots[result.snapshots.length - 1];
    expect(latest.avgDuration).toBe(5);
  });

  it('computes bug rate per window', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', bugsFound: 2 }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', bugsFound: 0 }),
    ];
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const latest = result.snapshots[result.snapshots.length - 1];
    expect(latest.bugRate).toBe(1);
  });

  it('orders snapshots oldest first', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-01T10:00:00.000Z' }),
    ];
    const result = analyzeQualityTrends(entries, 7, 8, now);
    if (result.snapshots.length >= 2) {
      const first = new Date(result.snapshots[0].startDate);
      const last = new Date(result.snapshots[result.snapshots.length - 1].startDate);
      expect(first.getTime()).toBeLessThan(last.getTime());
    }
  });

  it('detects improving success rate', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // Prior week (Apr 1-7): 50% success
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-05T${10 + i}:00:00.000Z`,
        status: i < 5 ? 'ok' : 'error',
      }));
    }
    // Recent week (Apr 8-14): 90% success
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-12T${10 + i}:00:00.000Z`,
        status: i < 9 ? 'ok' : 'error',
      }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const srDim = result.dimensions.find((d) => d.name === 'successRate');
    expect(srDim?.direction).toBe('improving');
  });

  it('detects degrading success rate', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // Prior week: 90% success
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-05T${10 + i}:00:00.000Z`,
        status: i < 9 ? 'ok' : 'error',
      }));
    }
    // Recent week: 50% success
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-12T${10 + i}:00:00.000Z`,
        status: i < 5 ? 'ok' : 'error',
      }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const srDim = result.dimensions.find((d) => d.name === 'successRate');
    expect(srDim?.direction).toBe('degrading');
  });

  it('detects stable when change is small', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // Both weeks: 100% success
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ timestamp: `2026-04-05T${10 + i}:00:00.000Z` }));
      entries.push(makeEntry({ timestamp: `2026-04-12T${10 + i}:00:00.000Z` }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const srDim = result.dimensions.find((d) => d.name === 'successRate');
    expect(srDim?.direction).toBe('stable');
  });

  it('uses majority vote for overall direction', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // Prior week: 50% success, avg 10s, 2 bugs/rec
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-05T${10 + i}:00:00.000Z`,
        status: i < 5 ? 'ok' : 'error',
        durationSeconds: 10,
        bugsFound: 2,
      }));
    }
    // Recent week: 90% success, avg 5s, 0 bugs/rec (all improving)
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-12T${10 + i}:00:00.000Z`,
        status: i < 9 ? 'ok' : 'error',
        durationSeconds: 5,
        bugsFound: 0,
      }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    expect(result.overall).toBe('improving');
  });

  it('handles custom window size', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-08T10:00:00.000Z' }),
    ];
    const result = analyzeQualityTrends(entries, 3, 8, now);
    expect(result.windowDays).toBe(3);
  });

  it('handles single entry', () => {
    const result = analyzeQualityTrends([makeEntry()]);
    expect(result.totalRecordings).toBe(1);
    expect(result.dimensions).toEqual([]);
  });

  it('skips empty windows', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      // Big gap — no entries for weeks 2-7
      makeEntry({ timestamp: '2026-02-01T10:00:00.000Z' }),
    ];
    const result = analyzeQualityTrends(entries, 7, 8, now);
    // Should only have non-empty windows
    for (const s of result.snapshots) {
      expect(s.count).toBeGreaterThan(0);
    }
  });

  it('detects improving duration (lower is better)', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // Prior week: avg 20s
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ timestamp: `2026-04-05T${10 + i}:00:00.000Z`, durationSeconds: 20 }));
    }
    // Recent week: avg 5s
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ timestamp: `2026-04-12T${10 + i}:00:00.000Z`, durationSeconds: 5 }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const durDim = result.dimensions.find((d) => d.name === 'avgDuration');
    expect(durDim?.direction).toBe('improving');
  });

  it('computes change percentage', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    // Prior week: 50% success
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-05T${10 + i}:00:00.000Z`,
        status: i < 5 ? 'ok' : 'error',
      }));
    }
    // Recent week: 100% success
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({ timestamp: `2026-04-12T${10 + i}:00:00.000Z` }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const srDim = result.dimensions.find((d) => d.name === 'successRate');
    expect(srDim!.changePct).toBe(100); // 50 → 100 = +100%
  });

  it('handles bugsFound being undefined', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries = [
      { timestamp: '2026-04-05T10:00:00.000Z', sessionId: 's1', scenario: 'demo', status: 'ok' as const, durationSeconds: 5, backend: 'vhs' } as HistoryEntry,
      makeEntry({ timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = analyzeQualityTrends(entries, 7, 8, now);
    expect(result.totalRecordings).toBe(2);
  });
});

describe('formatQualityTrends', () => {
  it('formats empty result', () => {
    const result = analyzeQualityTrends([]);
    const text = formatQualityTrends(result);
    expect(text).toContain('Quality Trends');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ timestamp: `2026-04-05T${10 + i}:00:00.000Z` }));
      entries.push(makeEntry({ timestamp: `2026-04-12T${10 + i}:00:00.000Z` }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const text = formatQualityTrends(result);
    expect(text).toContain('Total recordings');
    expect(text).toContain('Window size');
    expect(text).toContain('Overall trend');
    expect(text).toContain('Time series');
  });

  it('shows direction icons', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ timestamp: `2026-04-05T${10 + i}:00:00.000Z` }));
      entries.push(makeEntry({ timestamp: `2026-04-12T${10 + i}:00:00.000Z` }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const text = formatQualityTrends(result);
    expect(text).toMatch(/📈|📉|➡️/);
  });

  it('shows dimension trends section', () => {
    const now = new Date('2026-04-14T12:00:00.000Z');
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-05T${10 + i}:00:00.000Z`,
        status: i < 3 ? 'ok' : 'error',
      }));
      entries.push(makeEntry({ timestamp: `2026-04-12T${10 + i}:00:00.000Z` }));
    }
    const result = analyzeQualityTrends(entries, 7, 8, now);
    const text = formatQualityTrends(result);
    expect(text).toContain('Dimension trends');
    expect(text).toContain('successRate');
  });
});
