import { describe, it, expect } from 'vitest';
import { analyzeTrends, formatTrendReport } from '../src/analytics/trends.js';
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

describe('analyzeTrends', () => {
  it('handles empty entries', () => {
    const result = analyzeTrends([]);
    expect(result.windows.length).toBe(0);
    expect(result.successTrend).toBe('stable');
    expect(result.totalEntries).toBe(0);
  });

  it('groups by date', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00Z' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00Z' }),
    ];
    const result = analyzeTrends(entries);
    expect(result.windows.length).toBe(2);
    expect(result.windows[0].label).toBe('2026-04-10');
    expect(result.windows[0].count).toBe(2);
  });

  it('calculates success rate per window', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-10T11:00:00Z', status: 'error' }),
    ];
    const result = analyzeTrends(entries);
    expect(result.windows[0].successRate).toBe(50);
  });

  it('detects improving success trend', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-08T10:00:00Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-09T10:00:00Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00Z', status: 'ok' }),
    ];
    const result = analyzeTrends(entries);
    expect(result.successTrend).toBe('improving');
  });

  it('detects declining success trend', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-08T10:00:00Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-09T10:00:00Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00Z', status: 'error' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00Z', status: 'error' }),
    ];
    const result = analyzeTrends(entries);
    expect(result.successTrend).toBe('declining');
  });

  it('detects stable trend', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00Z', status: 'ok' }),
    ];
    const result = analyzeTrends(entries);
    expect(result.successTrend).toBe('stable');
  });

  it('tracks bug trends', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-08T10:00:00Z', bugsFound: 5 }),
      makeEntry({ timestamp: '2026-04-09T10:00:00Z', bugsFound: 4 }),
      makeEntry({ timestamp: '2026-04-10T10:00:00Z', bugsFound: 1 }),
      makeEntry({ timestamp: '2026-04-11T10:00:00Z', bugsFound: 0 }),
    ];
    const result = analyzeTrends(entries);
    expect(result.bugTrend).toBe('improving');
  });

  it('sorts windows chronologically', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-11T10:00:00Z' }),
      makeEntry({ timestamp: '2026-04-09T10:00:00Z' }),
      makeEntry({ timestamp: '2026-04-10T10:00:00Z' }),
    ];
    const result = analyzeTrends(entries);
    expect(result.windows[0].label).toBe('2026-04-09');
    expect(result.windows[2].label).toBe('2026-04-11');
  });

  it('calculates average duration per window', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00Z', durationSeconds: 10 }),
      makeEntry({ timestamp: '2026-04-10T11:00:00Z', durationSeconds: 20 }),
    ];
    const result = analyzeTrends(entries);
    expect(result.windows[0].avgDuration).toBe(15);
  });
});

describe('formatTrendReport', () => {
  it('formats empty report', () => {
    const result = analyzeTrends([]);
    const text = formatTrendReport(result);
    expect(text).toContain('No recording data');
  });

  it('formats trend report with data', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00Z' }),
    ];
    const result = analyzeTrends(entries);
    const text = formatTrendReport(result);
    expect(text).toContain('Recording Trends');
    expect(text).toContain('Success Rate:');
    expect(text).toContain('Bug Count:');
    expect(text).toContain('Duration:');
  });

  it('shows trend direction icons', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00Z', status: 'ok' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00Z', status: 'ok' }),
    ];
    const result = analyzeTrends(entries);
    const text = formatTrendReport(result);
    expect(text).toMatch(/[↑→↓]/);
  });

  it('shows total count', () => {
    const entries = [
      makeEntry({ timestamp: '2026-04-10T10:00:00Z' }),
      makeEntry({ timestamp: '2026-04-11T10:00:00Z' }),
    ];
    const result = analyzeTrends(entries);
    const text = formatTrendReport(result);
    expect(text).toContain('Total: 2');
  });
});
