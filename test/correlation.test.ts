import { describe, it, expect } from 'vitest';
import { computeCorrelations, formatCorrelations } from '../src/analytics/correlation.js';
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

describe('computeCorrelations', () => {
  it('returns empty for insufficient data', () => {
    const entries = [makeEntry()];
    const result = computeCorrelations(entries);
    expect(result.pairs.length).toBe(0);
    expect(result.scenarios.length).toBe(1);
  });

  it('detects strong positive correlation (scenarios succeed/fail together)', () => {
    // 5 sessions where A and B always have the same outcome
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'error' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'error' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's4', scenario: 'A', status: 'error' }),
      makeEntry({ sessionId: 's4', scenario: 'B', status: 'error' }),
      makeEntry({ sessionId: 's5', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's5', scenario: 'B', status: 'ok' }),
    ];
    const result = computeCorrelations(entries);
    expect(result.pairs.length).toBe(1);
    expect(result.pairs[0].correlation).toBeCloseTo(1.0);
    expect(result.pairs[0].strength).toBe('strong-positive');
  });

  it('detects strong negative correlation (opposite outcomes)', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'error' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'error' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'error' }),
      makeEntry({ sessionId: 's4', scenario: 'A', status: 'error' }),
      makeEntry({ sessionId: 's4', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's5', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's5', scenario: 'B', status: 'error' }),
    ];
    const result = computeCorrelations(entries);
    expect(result.pairs[0].correlation).toBeCloseTo(-1.0);
    expect(result.pairs[0].strength).toBe('strong-negative');
  });

  it('detects weak correlation for independent scenarios', () => {
    // Random-ish pattern
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'error' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'error' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's4', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's4', scenario: 'B', status: 'ok' }),
    ];
    const result = computeCorrelations(entries);
    expect(result.pairs.length).toBe(1);
    expect(Math.abs(result.pairs[0].correlation)).toBeLessThan(0.7);
  });

  it('handles multiple scenarios', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'C', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'C', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'C', status: 'ok' }),
    ];
    const result = computeCorrelations(entries);
    // 3 pairs: A-B, A-C, B-C
    expect(result.scenarios.length).toBe(3);
    expect(result.pairs.length).toBeLessThanOrEqual(3);
  });

  it('respects minSessions parameter', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'ok' }),
    ];
    // Default min is 3 — only 2 shared sessions
    const result3 = computeCorrelations(entries, 3);
    expect(result3.pairs.length).toBe(0);

    const result2 = computeCorrelations(entries, 2);
    expect(result2.pairs.length).toBe(1);
  });

  it('only counts sessions where both scenarios appear', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      // B not in s1
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's4', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's4', scenario: 'B', status: 'ok' }),
    ];
    const result = computeCorrelations(entries);
    expect(result.pairs[0].sharedSessions).toBe(3); // s2, s3, s4 only
  });

  it('sorts pairs by absolute correlation descending', () => {
    // Create data with different correlation strengths
    const entries = [
      // A and B always succeed together (r=1.0)
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'C', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'error' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'error' }),
      makeEntry({ sessionId: 's2', scenario: 'C', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'C', status: 'error' }),
    ];
    const result = computeCorrelations(entries);
    if (result.pairs.length >= 2) {
      expect(Math.abs(result.pairs[0].correlation)).toBeGreaterThanOrEqual(
        Math.abs(result.pairs[result.pairs.length - 1].correlation),
      );
    }
  });

  it('handles all-success data (zero variance)', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'ok' }),
    ];
    const result = computeCorrelations(entries);
    // All values are 1, so variance is 0, correlation should be 0
    expect(result.pairs[0].correlation).toBe(0);
  });

  it('returns empty for single scenario', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ sessionId: `s${i}`, scenario: 'only-one' }),
    );
    const result = computeCorrelations(entries);
    expect(result.pairs.length).toBe(0);
    expect(result.scenarios.length).toBe(1);
  });
});

describe('formatCorrelations', () => {
  it('formats insufficient data', () => {
    const result = computeCorrelations([]);
    const text = formatCorrelations(result);
    expect(text).toContain('Insufficient data');
  });

  it('formats significant correlations', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'error' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'error' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'ok' }),
    ];
    const result = computeCorrelations(entries);
    const text = formatCorrelations(result);
    expect(text).toContain('Correlation Matrix');
    expect(text).toContain('r=');
  });

  it('shows pair count and session count', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's2', scenario: 'B', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'A', status: 'ok' }),
      makeEntry({ sessionId: 's3', scenario: 'B', status: 'ok' }),
    ];
    const result = computeCorrelations(entries);
    const text = formatCorrelations(result);
    expect(text).toContain('3 sessions');
    expect(text).toContain('1 pairs');
  });
});
