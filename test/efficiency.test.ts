import { describe, it, expect } from 'vitest';
import { computeEfficiency, formatEfficiency } from '../src/analytics/efficiency.js';
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

describe('computeEfficiency', () => {
  it('returns empty for no entries', () => {
    const result = computeEfficiency([]);
    expect(result.totalRecordings).toBe(0);
    expect(result.utilizationPct).toBe(0);
    expect(result.hourlyThroughput).toEqual([]);
  });

  it('computes total recording time', () => {
    const entries = [
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 20 }),
    ];
    const result = computeEfficiency(entries);
    expect(result.totalRecordingTime).toBe(30);
  });

  it('computes average duration', () => {
    const entries = [
      makeEntry({ durationSeconds: 4 }),
      makeEntry({ durationSeconds: 6 }),
    ];
    const result = computeEfficiency(entries);
    expect(result.avgDuration).toBe(5);
  });

  it('computes median duration', () => {
    const entries = [
      makeEntry({ durationSeconds: 1 }),
      makeEntry({ durationSeconds: 3 }),
      makeEntry({ durationSeconds: 100 }),
    ];
    const result = computeEfficiency(entries);
    expect(result.medianDuration).toBe(3);
  });

  it('computes even median for even count', () => {
    const entries = [
      makeEntry({ durationSeconds: 2 }),
      makeEntry({ durationSeconds: 4 }),
    ];
    const result = computeEfficiency(entries);
    expect(result.medianDuration).toBe(3);
  });

  it('computes throughput per hour', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T12:00:00.000Z' }),
    ];
    const result = computeEfficiency(entries);
    expect(result.throughputPerHour).toBeGreaterThan(0);
  });

  it('computes success rate and throughput', () => {
    const entries = [
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'error' }),
    ];
    const result = computeEfficiency(entries);
    expect(result.successRate).toBeCloseTo(66.67, 1);
    expect(result.successThroughput).toBeLessThanOrEqual(result.throughputPerHour);
  });

  it('computes idle analysis', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T12:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T13:00:00.000Z' }),
    ];
    const result = computeEfficiency(entries);
    expect(result.idle.longestIdleHours).toBe(2);
    expect(result.idle.avgIdleMinutes).toBeGreaterThan(0);
    expect(result.idle.idleGaps).toBeGreaterThanOrEqual(1);
  });

  it('computes hourly throughput', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:30:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T14:00:00.000Z' }),
    ];
    const result = computeEfficiency(entries);
    const hour10 = result.hourlyThroughput.find((b) => b.hour === 10);
    const hour14 = result.hourlyThroughput.find((b) => b.hour === 14);
    expect(hour10?.count).toBe(2);
    expect(hour14?.count).toBe(1);
  });

  it('handles single entry', () => {
    const result = computeEfficiency([makeEntry()]);
    expect(result.totalRecordings).toBe(1);
    expect(result.throughputPerHour).toBeGreaterThan(0);
    expect(result.idle.longestIdleHours).toBe(0);
  });

  it('computes utilization percentage', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', durationSeconds: 1800 }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z', durationSeconds: 1800 }),
    ];
    const result = computeEfficiency(entries);
    expect(result.utilizationPct).toBeGreaterThan(0);
    expect(result.utilizationPct).toBeLessThanOrEqual(100);
  });

  it('orders hourly buckets by hour', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T14:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T08:00:00.000Z' }),
    ];
    const result = computeEfficiency(entries);
    const hours = result.hourlyThroughput.map((b) => b.hour);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
  });

  it('counts idle gaps greater than 1 hour', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:30:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T14:00:00.000Z' }),
    ];
    const result = computeEfficiency(entries);
    expect(result.idle.idleGaps).toBe(1);
  });
});

describe('formatEfficiency', () => {
  it('formats empty result', () => {
    const result = computeEfficiency([]);
    const text = formatEfficiency(result);
    expect(text).toContain('Recording Efficiency Metrics');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z' }),
    ];
    const result = computeEfficiency(entries);
    const text = formatEfficiency(result);
    expect(text).toContain('Total recordings');
    expect(text).toContain('Utilization');
    expect(text).toContain('Throughput');
    expect(text).toContain('Avg duration');
    expect(text).toContain('Longest idle');
  });

  it('shows hourly breakdown', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:30:00.000Z' }),
    ];
    const result = computeEfficiency(entries);
    const text = formatEfficiency(result);
    expect(text).toContain('Recordings by hour');
    expect(text).toContain('█');
  });
});
