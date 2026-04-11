import { describe, it, expect } from 'vitest';
import { detectDuplicates, formatDuplicates } from '../src/analytics/duplicates.js';
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

describe('detectDuplicates', () => {
  it('returns no duplicates for unique entries', () => {
    const entries = [
      makeEntry({ scenario: 'a', sessionId: 's1' }),
      makeEntry({ scenario: 'b', sessionId: 's2' }),
      makeEntry({ scenario: 'c', sessionId: 's3' }),
    ];
    const result = detectDuplicates(entries);
    expect(result.totalDuplicates).toBe(0);
    expect(result.uniqueCount).toBe(3);
    expect(result.groups.length).toBe(0);
  });

  it('detects exact duplicates', () => {
    const entry = makeEntry();
    const entries = [entry, entry, entry]; // 3 identical entries
    const result = detectDuplicates(entries);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].type).toBe('exact');
    expect(result.groups[0].duplicateCount).toBe(2);
    expect(result.uniqueCount).toBe(1);
  });

  it('detects near-duplicates within time window', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', sessionId: 's1' }),
      makeEntry({ timestamp: '2026-04-11T10:00:30.000Z', sessionId: 's2' }),
      makeEntry({ timestamp: '2026-04-11T10:00:45.000Z', sessionId: 's3' }),
    ];
    const result = detectDuplicates(entries, 60);
    const nearGroups = result.groups.filter((g) => g.type === 'near');
    expect(nearGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag entries outside window as near-duplicates', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', sessionId: 's1' }),
      makeEntry({ timestamp: '2026-04-11T12:00:00.000Z', sessionId: 's2' }),
    ];
    const result = detectDuplicates(entries, 60);
    expect(result.totalDuplicates).toBe(0);
  });

  it('handles empty input', () => {
    const result = detectDuplicates([]);
    expect(result.totalAnalyzed).toBe(0);
    expect(result.totalDuplicates).toBe(0);
    expect(result.groups.length).toBe(0);
  });

  it('separates different scenarios', () => {
    const entries = [
      makeEntry({ scenario: 'a', sessionId: 's1' }),
      makeEntry({ scenario: 'a', sessionId: 's1' }), // exact dup of 'a'
      makeEntry({ scenario: 'b', sessionId: 's1' }),
    ];
    const result = detectDuplicates(entries);
    const exactGroups = result.groups.filter((g) => g.type === 'exact');
    expect(exactGroups.length).toBe(1);
    expect(exactGroups[0].scenario).toBe('a');
    expect(result.totalDuplicates).toBe(1);
  });

  it('distinguishes different statuses as not exact duplicates', () => {
    const entries = [
      makeEntry({ status: 'ok' }),
      makeEntry({ status: 'error' }),
    ];
    const result = detectDuplicates(entries);
    expect(result.groups.filter((g) => g.type === 'exact').length).toBe(0);
  });

  it('counts unique correctly with multiple duplicate groups', () => {
    const entries = [
      makeEntry({ scenario: 'a', sessionId: 's1' }),
      makeEntry({ scenario: 'a', sessionId: 's1' }),
      makeEntry({ scenario: 'a', sessionId: 's1' }), // 3 copies of a
      makeEntry({ scenario: 'b', sessionId: 's2' }),
      makeEntry({ scenario: 'b', sessionId: 's2' }), // 2 copies of b
      makeEntry({ scenario: 'c', sessionId: 's3' }),  // unique
    ];
    const result = detectDuplicates(entries);
    expect(result.totalAnalyzed).toBe(6);
    expect(result.totalDuplicates).toBe(3); // 2 extra a + 1 extra b
    expect(result.uniqueCount).toBe(3);
  });

  it('respects custom window size', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', sessionId: 's1' }),
      makeEntry({ timestamp: '2026-04-11T10:00:10.000Z', sessionId: 's2' }),
    ];
    // 5-second window — 10 seconds apart is outside
    const result5 = detectDuplicates(entries, 5);
    expect(result5.totalDuplicates).toBe(0);

    // 15-second window — 10 seconds apart is inside
    const result15 = detectDuplicates(entries, 15);
    const nearGroups = result15.groups.filter((g) => g.type === 'near');
    expect(nearGroups.length).toBeGreaterThanOrEqual(1);
  });
});

describe('formatDuplicates', () => {
  it('formats no duplicates', () => {
    const result = detectDuplicates([makeEntry()]);
    const text = formatDuplicates(result);
    expect(text).toContain('No duplicates');
  });

  it('formats exact duplicates', () => {
    const entry = makeEntry();
    const result = detectDuplicates([entry, entry]);
    const text = formatDuplicates(result);
    expect(text).toContain('Exact Duplicates');
    expect(text).toContain('basic');
  });

  it('formats summary with dedup count', () => {
    const entry = makeEntry();
    const result = detectDuplicates([entry, entry, entry]);
    const text = formatDuplicates(result);
    expect(text).toContain('After dedup');
    expect(text).toContain('1 unique');
  });
});
