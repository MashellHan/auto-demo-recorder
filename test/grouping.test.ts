import { describe, it, expect } from 'vitest';
import { groupRecordings, formatGrouping } from '../src/analytics/grouping.js';
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

describe('groupRecordings', () => {
  it('groups by day', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T08:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-10T16:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = groupRecordings(entries, 'day');
    expect(result.groups.length).toBe(2);
    expect(result.groups[0].key).toBe('2026-04-10');
    expect(result.groups[0].count).toBe(2);
    expect(result.groups[1].key).toBe('2026-04-11');
    expect(result.groups[1].count).toBe(1);
  });

  it('groups by scenario', () => {
    const entries = [
      makeEntry({ scenario: 'basic' }),
      makeEntry({ scenario: 'basic' }),
      makeEntry({ scenario: 'advanced' }),
    ];
    const result = groupRecordings(entries, 'scenario');
    expect(result.groups.length).toBe(2);
    const basic = result.groups.find((g) => g.key === 'basic');
    expect(basic?.count).toBe(2);
  });

  it('groups by backend', () => {
    const entries = [
      makeEntry({ backend: 'vhs' }),
      makeEntry({ backend: 'vhs' }),
      makeEntry({ backend: 'browser' }),
    ];
    const result = groupRecordings(entries, 'backend');
    expect(result.groups.length).toBe(2);
  });

  it('groups by status', () => {
    const entries = [
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'error' }),
    ];
    const result = groupRecordings(entries, 'status');
    const ok = result.groups.find((g) => g.key === 'ok');
    const error = result.groups.find((g) => g.key === 'error');
    expect(ok?.count).toBe(2);
    expect(error?.count).toBe(1);
  });

  it('groups by week', () => {
    const entries = [
      makeEntry({ timestamp: '2026-03-30T10:00:00.000Z' }), // Late March
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }), // Mid April (12 days apart)
    ];
    const result = groupRecordings(entries, 'week');
    expect(result.groups.length).toBe(2);
  });

  it('computes aggregate stats per group', () => {
    const entries = [
      makeEntry({ scenario: 'basic', status: 'ok', durationSeconds: 10, bugsFound: 0 }),
      makeEntry({ scenario: 'basic', status: 'error', durationSeconds: 20, bugsFound: 3 }),
    ];
    const result = groupRecordings(entries, 'scenario');
    const group = result.groups[0];
    expect(group.successRate).toBe(0.5);
    expect(group.avgDuration).toBe(15);
    expect(group.totalBugs).toBe(3);
  });

  it('sorts groups by key', () => {
    const entries = [
      makeEntry({ scenario: 'c' }),
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
    ];
    const result = groupRecordings(entries, 'scenario');
    expect(result.groups.map((g) => g.key)).toEqual(['a', 'b', 'c']);
  });

  it('handles empty input', () => {
    const result = groupRecordings([]);
    expect(result.groups.length).toBe(0);
    expect(result.totalAnalyzed).toBe(0);
  });

  it('defaults to day grouping', () => {
    const entries = [makeEntry()];
    const result = groupRecordings(entries);
    expect(result.groupBy).toBe('day');
  });
});

describe('formatGrouping', () => {
  it('formats empty data', () => {
    const result = groupRecordings([]);
    const text = formatGrouping(result);
    expect(text).toContain('No recordings');
  });

  it('formats grouped data with header', () => {
    const entries = [
      makeEntry({ scenario: 'basic', durationSeconds: 10 }),
      makeEntry({ scenario: 'basic', durationSeconds: 20 }),
      makeEntry({ scenario: 'advanced', durationSeconds: 30 }),
    ];
    const result = groupRecordings(entries, 'scenario');
    const text = formatGrouping(result);
    expect(text).toContain('by scenario');
    expect(text).toContain('basic');
    expect(text).toContain('advanced');
    expect(text).toContain('Total: 2 groups');
  });
});
