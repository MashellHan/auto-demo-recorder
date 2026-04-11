import { describe, it, expect } from 'vitest';
import { analyzeCapacity, formatCapacity } from '../src/analytics/capacity.js';
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

describe('analyzeCapacity', () => {
  it('returns empty for no entries', () => {
    const result = analyzeCapacity([]);
    expect(result.overallPerDay).toBe(0);
    expect(result.scenarios).toEqual([]);
    expect(result.totalRecordings).toBe(0);
    expect(result.bottleneck).toBe('');
  });

  it('computes overall throughput from 7d window', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 14 }, (_, i) =>
      makeEntry({
        timestamp: `2026-04-${(11 - (i % 7)).toString().padStart(2, '0')}T${10 + Math.floor(i / 7)}:00:00.000Z`,
      }),
    );
    const result = analyzeCapacity(entries, now);
    expect(result.overallPerDay).toBe(2);
    expect(result.overallPerWeek).toBe(14);
  });

  it('identifies bottleneck scenario', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      // 'fast' scenario: 5 recent recordings
      ...Array.from({ length: 5 }, () =>
        makeEntry({ scenario: 'fast', timestamp: '2026-04-11T10:00:00.000Z' }),
      ),
      // 'slow' scenario: 1 recent recording
      makeEntry({ scenario: 'slow', timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeCapacity(entries, now);
    expect(result.bottleneck).toBe('slow');
  });

  it('marks bottleneck scenario in profiles', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'a', timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ scenario: 'b', timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ scenario: 'b', timestamp: '2026-04-11T11:00:00.000Z' }),
    ];
    const result = analyzeCapacity(entries, now);
    const bottleneck = result.scenarios.find((s) => s.isBottleneck);
    expect(bottleneck?.name).toBe('a');
  });

  it('computes daily recording minutes', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeEntry({
        timestamp: `2026-04-${(11 - i).toString().padStart(2, '0')}T10:00:00.000Z`,
        durationSeconds: 60,
      }),
    );
    const result = analyzeCapacity(entries, now);
    // 1/day * 60s / 60 = 1 minute/day
    expect(result.dailyRecordingMinutes).toBe(1);
  });

  it('computes capacity utilization', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeEntry({
        timestamp: `2026-04-${(11 - i).toString().padStart(2, '0')}T10:00:00.000Z`,
        durationSeconds: 60,
      }),
    );
    const result = analyzeCapacity(entries, now, 8);
    // 1 min / (8 * 60 min) * 100 = 0.21%
    expect(result.capacityUtilization).toBeGreaterThan(0);
    expect(result.capacityUtilization).toBeLessThan(1);
  });

  it('sorts scenarios by throughput ascending', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'low', timestamp: '2026-04-11T10:00:00.000Z' }),
      ...Array.from({ length: 3 }, () =>
        makeEntry({ scenario: 'high', timestamp: '2026-04-11T10:00:00.000Z' }),
      ),
    ];
    const result = analyzeCapacity(entries, now);
    expect(result.scenarios[0].name).toBe('low');
    expect(result.scenarios[1].name).toBe('high');
  });

  it('builds target projections', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeEntry({
        timestamp: `2026-04-${(11 - i).toString().padStart(2, '0')}T10:00:00.000Z`,
      }),
    );
    const result = analyzeCapacity(entries, now);
    expect(result.targets.length).toBeGreaterThan(0);
    // Should have targets for 100, 500, etc.
    const t100 = result.targets.find((t) => t.target === 100);
    expect(t100).toBeDefined();
    expect(t100!.remaining).toBe(93);
    expect(t100!.reached).toBe(false);
  });

  it('marks reached targets', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 120 }, (_, i) =>
      makeEntry({
        timestamp: `2026-04-${(11 - (i % 7)).toString().padStart(2, '0')}T${10 + Math.floor(i / 7)}:00:00.000Z`,
      }),
    );
    const result = analyzeCapacity(entries, now);
    const t100 = result.targets.find((t) => t.target === 100);
    expect(t100!.reached).toBe(true);
  });

  it('handles single entry', () => {
    const result = analyzeCapacity([makeEntry()]);
    expect(result.totalRecordings).toBe(1);
    expect(result.activeScenarios).toBe(1);
  });

  it('computes avg duration per scenario', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'demo', timestamp: '2026-04-11T10:00:00.000Z', durationSeconds: 4 }),
      makeEntry({ scenario: 'demo', timestamp: '2026-04-11T11:00:00.000Z', durationSeconds: 6 }),
    ];
    const result = analyzeCapacity(entries, now);
    const demo = result.scenarios.find((s) => s.name === 'demo');
    expect(demo?.avgDuration).toBe(5);
  });

  it('only counts recent entries in 7d throughput', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-03-01T10:00:00.000Z' }),
    ];
    const result = analyzeCapacity(entries, now);
    // Only 1 entry in the 7d window
    expect(result.overallPerWeek).toBe(1);
  });

  it('skips far-surpassed milestones', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 300 }, (_, i) =>
      makeEntry({
        timestamp: `2026-04-${(11 - (i % 7)).toString().padStart(2, '0')}T${10 + Math.floor(i / 50)}:00:00.000Z`,
      }),
    );
    const result = analyzeCapacity(entries, now);
    // 100 milestone should be skipped (300 > 100 * 2)
    const t100 = result.targets.find((t) => t.target === 100);
    expect(t100).toBeUndefined();
  });

  it('uses custom work hours', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeEntry({
        timestamp: `2026-04-${(11 - i).toString().padStart(2, '0')}T10:00:00.000Z`,
        durationSeconds: 3600,
      }),
    );
    const result4h = analyzeCapacity(entries, now, 4);
    const result8h = analyzeCapacity(entries, now, 8);
    // 4h work day should show higher utilization than 8h
    expect(result4h.capacityUtilization).toBeGreaterThan(result8h.capacityUtilization);
  });
});

describe('formatCapacity', () => {
  it('formats empty result', () => {
    const result = analyzeCapacity([]);
    const text = formatCapacity(result);
    expect(text).toContain('Capacity Planner');
    expect(text).toContain('No recordings');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeCapacity(entries);
    const text = formatCapacity(result);
    expect(text).toContain('Total recordings');
    expect(text).toContain('throughput');
    expect(text).toContain('Target projections');
  });

  it('shows bottleneck indicator', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'fast', timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ scenario: 'fast', timestamp: '2026-04-11T11:00:00.000Z' }),
      makeEntry({ scenario: 'slow', timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = analyzeCapacity(entries, now);
    const text = formatCapacity(result);
    expect(text).toContain('Bottleneck');
    expect(text).toContain('slow');
  });

  it('shows reached targets with checkmark', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 120 }, (_, i) =>
      makeEntry({
        timestamp: `2026-04-${(11 - (i % 7)).toString().padStart(2, '0')}T${10 + Math.floor(i / 7)}:00:00.000Z`,
      }),
    );
    const result = analyzeCapacity(entries, now);
    const text = formatCapacity(result);
    expect(text).toContain('✅ reached');
  });
});
