import { describe, it, expect } from 'vitest';
import { detectOutliers, formatOutliers } from '../src/analytics/outliers.js';
import type { HistoryEntry } from '../src/analytics/history.js';

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

describe('detectOutliers', () => {
  it('requires at least 3 entries', () => {
    const result = detectOutliers([makeEntry(), makeEntry()]);
    expect(result.outliers.length).toBe(0);
    expect(result.totalAnalyzed).toBe(2);
  });

  it('detects duration outlier (slow)', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ durationSeconds: 10 })),
      makeEntry({ durationSeconds: 200 }), // extreme outlier
    ];
    const result = detectOutliers(entries);
    const durationOutliers = result.outliers.filter((o) => o.type === 'duration');
    expect(durationOutliers.length).toBeGreaterThanOrEqual(1);
    expect(durationOutliers[0].reason).toContain('slower');
  });

  it('detects duration outlier (fast)', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ durationSeconds: 100 })),
      makeEntry({ durationSeconds: 1 }), // extreme outlier
    ];
    const result = detectOutliers(entries);
    const durationOutliers = result.outliers.filter((o) => o.type === 'duration');
    expect(durationOutliers.length).toBeGreaterThanOrEqual(1);
    expect(durationOutliers[0].reason).toContain('faster');
  });

  it('detects bug outlier', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ bugsFound: 0 })),
      makeEntry({ bugsFound: 20 }), // extreme outlier
    ];
    const result = detectOutliers(entries);
    const bugOutliers = result.outliers.filter((o) => o.type === 'bugs');
    expect(bugOutliers.length).toBeGreaterThanOrEqual(1);
  });

  it('detects status outlier (error in mostly-ok set)', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ status: 'ok' })),
      makeEntry({ status: 'error' }), // 1 error in 11 entries = ~91% ok
    ];
    const result = detectOutliers(entries);
    const statusOutliers = result.outliers.filter((o) => o.type === 'status');
    expect(statusOutliers.length).toBe(1);
  });

  it('does not flag status when many errors', () => {
    const entries = [
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'error' }),
      makeEntry({ status: 'error' }),
    ];
    const result = detectOutliers(entries);
    const statusOutliers = result.outliers.filter((o) => o.type === 'status');
    expect(statusOutliers.length).toBe(0); // Not >80% ok
  });

  it('returns no outliers for consistent data', () => {
    const entries = Array.from({ length: 10 }, () => makeEntry());
    const result = detectOutliers(entries);
    expect(result.outliers.length).toBe(0);
  });

  it('sorts by deviation descending', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ durationSeconds: 10 })),
      makeEntry({ durationSeconds: 50 }), // moderate outlier
      makeEntry({ durationSeconds: 200 }), // extreme outlier
    ];
    const result = detectOutliers(entries);
    if (result.outliers.length >= 2) {
      expect(result.outliers[0].deviation).toBeGreaterThanOrEqual(result.outliers[1].deviation);
    }
  });

  it('respects custom threshold', () => {
    const entries = [
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 20 }), // mild outlier
    ];
    const strict = detectOutliers(entries, 1.0); // Strict threshold
    const relaxed = detectOutliers(entries, 5.0); // Relaxed threshold
    expect(strict.outliers.length).toBeGreaterThanOrEqual(relaxed.outliers.length);
  });

  it('provides avg and stddev', () => {
    const entries = [
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 20 }),
      makeEntry({ durationSeconds: 30 }),
    ];
    const result = detectOutliers(entries);
    expect(result.avgDuration).toBe(20);
    expect(result.stdDevDuration).toBeGreaterThan(0);
  });
});

describe('formatOutliers', () => {
  it('formats insufficient data', () => {
    const result = detectOutliers([makeEntry()]);
    const text = formatOutliers(result);
    expect(text).toContain('at least 3');
  });

  it('formats no outliers', () => {
    const entries = Array.from({ length: 5 }, () => makeEntry());
    const result = detectOutliers(entries);
    const text = formatOutliers(result);
    expect(text).toContain('No outliers');
  });

  it('formats outlier details', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ durationSeconds: 10 })),
      makeEntry({ durationSeconds: 200 }),
    ];
    const result = detectOutliers(entries);
    const text = formatOutliers(result);
    expect(text).toContain('Outlier Detection');
    expect(text).toContain('outlier');
  });
});
