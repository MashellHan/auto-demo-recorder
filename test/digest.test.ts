import { describe, it, expect } from 'vitest';
import { generateDigest, formatDigest } from '../src/analytics/digest.js';
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

describe('generateDigest', () => {
  it('returns no-data digest for empty entries', () => {
    const result = generateDigest([]);
    expect(result.hasData).toBe(false);
    expect(result.totalRecordings).toBe(0);
    expect(result.concerns.length).toBeGreaterThan(0);
  });

  it('filters entries by daily period', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-09T10:00:00.000Z' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.totalRecordings).toBe(1);
  });

  it('filters entries by weekly period', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-09T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-03-01T10:00:00.000Z' }),
    ];
    const result = generateDigest(entries, 'weekly', now);
    expect(result.totalRecordings).toBe(2);
  });

  it('computes success rate', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', status: 'error' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.successRate).toBe(50);
    expect(result.failureCount).toBe(1);
  });

  it('identifies most and least active scenarios', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', scenario: 'active' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z', scenario: 'active' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', scenario: 'inactive' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.mostActive).toBe('active');
    expect(result.leastActive).toBe('inactive');
  });

  it('generates perfect run highlight', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
    );
    const result = generateDigest(entries, 'daily', now);
    expect(result.highlights.some((h) => h.label === 'Perfect run')).toBe(true);
  });

  it('generates failure concern', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'error' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.concerns.some((c) => c.label === 'Failures')).toBe(true);
  });

  it('generates bug concern', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', bugsFound: 3 }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.concerns.some((c) => c.label === 'Bugs found')).toBe(true);
  });

  it('generates high volume highlight', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = Array.from({ length: 12 }, (_, i) =>
      makeEntry({ timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
    );
    const result = generateDigest(entries, 'daily', now);
    expect(result.highlights.some((h) => h.label === 'High volume')).toBe(true);
  });

  it('generates growth highlight compared to prior period', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = [
      // Prior day: 1 recording
      makeEntry({ timestamp: '2026-04-10T10:00:00.000Z' }),
      // Current day: 5 recordings
      ...Array.from({ length: 5 }, (_, i) =>
        makeEntry({ timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.highlights.some((h) => h.label === 'Growing')).toBe(true);
  });

  it('generates volume drop concern', () => {
    const now = new Date('2026-04-11T23:00:00.000Z');
    const entries = [
      // Prior day: 10 recordings
      ...Array.from({ length: 10 }, (_, i) =>
        makeEntry({ timestamp: `2026-04-10T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      // Current day: 2 recordings
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.concerns.some((c) => c.label === 'Volume drop')).toBe(true);
  });

  it('generates good coverage highlight', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', scenario: 'a' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z', scenario: 'b' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', scenario: 'c' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.highlights.some((h) => h.label === 'Good coverage')).toBe(true);
  });

  it('computes avg duration', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', durationSeconds: 4 }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z', durationSeconds: 6 }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.avgDuration).toBe(5);
  });

  it('sets correct period dates', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const result = generateDigest([], 'weekly', now);
    expect(result.endDate).toBe('2026-04-11');
    expect(result.startDate).toBe('2026-04-04');
  });

  it('generates low success rate concern', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T11:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-11T12:00:00.000Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-11T09:00:00.000Z', status: 'error' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    expect(result.concerns.some((c) => c.label === 'Low success rate')).toBe(true);
  });
});

describe('formatDigest', () => {
  it('formats no-data digest', () => {
    const result = generateDigest([]);
    const text = formatDigest(result);
    expect(text).toContain('Digest');
    expect(text).toContain('No activity');
  });

  it('formats daily digest with data', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    const text = formatDigest(result);
    expect(text).toContain('Daily');
    expect(text).toContain('Recordings');
    expect(text).toContain('Success rate');
  });

  it('formats weekly digest', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = generateDigest(entries, 'weekly', now);
    const text = formatDigest(result);
    expect(text).toContain('Weekly');
  });

  it('shows highlights and concerns', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00.000Z', status: 'error' }),
    ];
    const result = generateDigest(entries, 'daily', now);
    const text = formatDigest(result);
    expect(text).toContain('Concerns');
  });
});
