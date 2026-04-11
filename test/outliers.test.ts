import { describe, it, expect } from 'vitest';
import { detectOutliers, detectOutliersPerScenario, formatOutliers, formatOutliersPerScenario } from '../src/analytics/outliers.js';
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

describe('detectOutliersPerScenario', () => {
  it('groups entries by scenario', () => {
    const entries = [
      ...Array.from({ length: 5 }, () => makeEntry({ scenario: 'basic', durationSeconds: 10 })),
      ...Array.from({ length: 5 }, () => makeEntry({ scenario: 'advanced', durationSeconds: 50 })),
    ];
    const result = detectOutliersPerScenario(entries);
    expect(result.scenarios.size).toBe(2);
    expect(result.totalAnalyzed).toBe(10);
  });

  it('does not flag inherently different scenarios as outliers', () => {
    // "advanced" consistently runs at 50s and "basic" at 10s — no outliers within either group
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'basic', durationSeconds: 10 })),
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'advanced', durationSeconds: 50 })),
    ];
    const result = detectOutliersPerScenario(entries);
    expect(result.totalOutliers).toBe(0);
  });

  it('detects outlier within a scenario group', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'basic', durationSeconds: 10 })),
      makeEntry({ scenario: 'basic', durationSeconds: 200 }), // outlier within basic
      ...Array.from({ length: 5 }, () => makeEntry({ scenario: 'advanced', durationSeconds: 50 })),
    ];
    const result = detectOutliersPerScenario(entries);
    const basicResult = result.scenarios.get('basic')!;
    expect(basicResult.outliers.length).toBeGreaterThanOrEqual(1);
    const advancedResult = result.scenarios.get('advanced')!;
    expect(advancedResult.outliers.length).toBe(0);
  });

  it('handles single scenario with insufficient data', () => {
    const entries = [
      makeEntry({ scenario: 'basic', durationSeconds: 10 }),
      makeEntry({ scenario: 'basic', durationSeconds: 20 }),
    ];
    const result = detectOutliersPerScenario(entries);
    const basicResult = result.scenarios.get('basic')!;
    expect(basicResult.outliers.length).toBe(0); // <3 entries
  });

  it('handles empty input', () => {
    const result = detectOutliersPerScenario([]);
    expect(result.totalAnalyzed).toBe(0);
    expect(result.totalOutliers).toBe(0);
    expect(result.scenarios.size).toBe(0);
  });

  it('respects custom threshold per scenario', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'basic', durationSeconds: 10 })),
      makeEntry({ scenario: 'basic', durationSeconds: 20 }), // mild outlier
    ];
    const strict = detectOutliersPerScenario(entries, 1.0);
    const relaxed = detectOutliersPerScenario(entries, 5.0);
    const strictOutliers = strict.scenarios.get('basic')!.outliers.length;
    const relaxedOutliers = relaxed.scenarios.get('basic')!.outliers.length;
    expect(strictOutliers).toBeGreaterThanOrEqual(relaxedOutliers);
  });
});

describe('formatOutliersPerScenario', () => {
  it('formats empty data', () => {
    const result = detectOutliersPerScenario([]);
    const text = formatOutliersPerScenario(result);
    expect(text).toContain('No recordings');
  });

  it('formats per-scenario results', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'basic', durationSeconds: 10 })),
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'advanced', durationSeconds: 50 })),
    ];
    const result = detectOutliersPerScenario(entries);
    const text = formatOutliersPerScenario(result);
    expect(text).toContain('Per-Scenario');
    expect(text).toContain('basic');
    expect(text).toContain('advanced');
    expect(text).toContain('No outliers');
  });

  it('formats scenario with outliers', () => {
    const entries = [
      ...Array.from({ length: 10 }, () => makeEntry({ scenario: 'basic', durationSeconds: 10 })),
      makeEntry({ scenario: 'basic', durationSeconds: 200 }),
    ];
    const result = detectOutliersPerScenario(entries);
    const text = formatOutliersPerScenario(result);
    expect(text).toContain('slower');
    expect(text).toContain('z=');
  });
});
