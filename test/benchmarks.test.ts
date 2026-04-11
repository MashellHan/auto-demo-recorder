import { describe, it, expect } from 'vitest';
import { computeBenchmarks, formatBenchmarks } from '../src/analytics/benchmarks.js';
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

describe('computeBenchmarks', () => {
  it('computes p50 (median) correctly', () => {
    const entries = [
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 20 }),
      makeEntry({ durationSeconds: 30 }),
      makeEntry({ durationSeconds: 40 }),
      makeEntry({ durationSeconds: 50 }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].p50).toBe(30);
  });

  it('computes p95 correctly', () => {
    const entries = Array.from({ length: 100 }, (_, i) =>
      makeEntry({ durationSeconds: i + 1 }),
    );
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].p95).toBeGreaterThan(90);
  });

  it('computes mean correctly', () => {
    const entries = [
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 20 }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].mean).toBe(15);
  });

  it('computes min and max', () => {
    const entries = [
      makeEntry({ durationSeconds: 5 }),
      makeEntry({ durationSeconds: 15 }),
      makeEntry({ durationSeconds: 25 }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].min).toBe(5);
    expect(result.scenarios[0].max).toBe(25);
  });

  it('computes standard deviation', () => {
    const entries = [
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 10 }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].stddev).toBe(0);
  });

  it('identifies fastest and slowest scenarios', () => {
    const entries = [
      makeEntry({ scenario: 'fast', durationSeconds: 5 }),
      makeEntry({ scenario: 'slow', durationSeconds: 30 }),
      makeEntry({ scenario: 'medium', durationSeconds: 15 }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.global.fastestScenario).toBe('fast');
    expect(result.global.slowestScenario).toBe('slow');
  });

  it('groups by scenario', () => {
    const entries = [
      makeEntry({ scenario: 'a', durationSeconds: 10 }),
      makeEntry({ scenario: 'a', durationSeconds: 20 }),
      makeEntry({ scenario: 'b', durationSeconds: 5 }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios.length).toBe(2);
    const aScenario = result.scenarios.find((s) => s.scenario === 'a');
    expect(aScenario?.count).toBe(2);
    expect(aScenario?.mean).toBe(15);
  });

  it('computes improvement rate (getting faster)', () => {
    const entries = [
      makeEntry({ scenario: 'basic', durationSeconds: 20, timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 18, timestamp: '2026-04-02T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 10, timestamp: '2026-04-03T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 8, timestamp: '2026-04-04T10:00:00.000Z' }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].improvementRate).toBeLessThan(0);
  });

  it('computes improvement rate (getting slower)', () => {
    const entries = [
      makeEntry({ scenario: 'basic', durationSeconds: 10, timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 12, timestamp: '2026-04-02T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 20, timestamp: '2026-04-03T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 22, timestamp: '2026-04-04T10:00:00.000Z' }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].improvementRate).toBeGreaterThan(0);
  });

  it('returns 0 improvement rate for small datasets', () => {
    const entries = [
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 20 }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].improvementRate).toBe(0);
  });

  it('handles empty input', () => {
    const result = computeBenchmarks([]);
    expect(result.scenarios.length).toBe(0);
    expect(result.global.totalRecordings).toBe(0);
    expect(result.global.avgDuration).toBe(0);
  });

  it('sorts scenarios alphabetically', () => {
    const entries = [
      makeEntry({ scenario: 'c' }),
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
    ];
    const result = computeBenchmarks(entries);
    expect(result.scenarios.map((s) => s.scenario)).toEqual(['a', 'b', 'c']);
  });

  it('computes global percentiles', () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry({ durationSeconds: (i + 1) * 2 }),
    );
    const result = computeBenchmarks(entries);
    expect(result.global.p50).toBeGreaterThan(0);
    expect(result.global.p95).toBeGreaterThan(result.global.p50);
    expect(result.global.p99).toBeGreaterThanOrEqual(result.global.p95);
  });

  it('handles single entry per scenario', () => {
    const entries = [makeEntry({ durationSeconds: 10 })];
    const result = computeBenchmarks(entries);
    expect(result.scenarios[0].p50).toBe(10);
    expect(result.scenarios[0].p95).toBe(10);
    expect(result.scenarios[0].p99).toBe(10);
    expect(result.scenarios[0].min).toBe(10);
    expect(result.scenarios[0].max).toBe(10);
  });
});

describe('formatBenchmarks', () => {
  it('formats empty results', () => {
    const result = computeBenchmarks([]);
    const text = formatBenchmarks(result);
    expect(text).toContain('Performance Benchmarks');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ scenario: 'fast', durationSeconds: 5 }),
      makeEntry({ scenario: 'slow', durationSeconds: 30 }),
    ];
    const result = computeBenchmarks(entries);
    const text = formatBenchmarks(result);
    expect(text).toContain('Performance Benchmarks');
    expect(text).toContain('Global');
    expect(text).toContain('Per-Scenario');
    expect(text).toContain('fast');
    expect(text).toContain('slow');
    expect(text).toContain('p50');
    expect(text).toContain('p95');
  });

  it('shows improvement trend', () => {
    const entries = [
      makeEntry({ scenario: 'basic', durationSeconds: 20, timestamp: '2026-04-01T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 18, timestamp: '2026-04-02T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 10, timestamp: '2026-04-03T10:00:00.000Z' }),
      makeEntry({ scenario: 'basic', durationSeconds: 8, timestamp: '2026-04-04T10:00:00.000Z' }),
    ];
    const result = computeBenchmarks(entries);
    const text = formatBenchmarks(result);
    expect(text).toContain('↓');
  });
});
