import { describe, it, expect } from 'vitest';
import { generateHeatMap, formatHeatMap } from '../src/analytics/heatmap.js';
import type { HistoryEntry } from '../src/analytics/history.js';

function makeEntry(timestamp: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp,
    sessionId: '2026-04-11_10-00',
    scenario: 'basic',
    status: 'ok',
    durationSeconds: 12.5,
    bugsFound: 0,
    backend: 'vhs',
    ...overrides,
  };
}

describe('generateHeatMap', () => {
  it('handles empty entries', () => {
    const result = generateHeatMap([]);
    expect(result.totalRecordings).toBe(0);
    expect(result.maxCount).toBe(0);
    expect(result.cells.length).toBe(168); // 7 * 24
  });

  it('counts entries in correct slots', () => {
    // Use local time to avoid timezone issues with getHours()
    const friday = new Date(2026, 3, 10, 10, 0, 0); // April 10, 2026 10am local = Friday
    const friday2 = new Date(2026, 3, 10, 10, 30, 0);
    const friday3 = new Date(2026, 3, 10, 14, 0, 0);
    const entries = [
      makeEntry(friday.toISOString()),
      makeEntry(friday2.toISOString()),
      makeEntry(friday3.toISOString()),
    ];
    const result = generateHeatMap(entries);
    expect(result.totalRecordings).toBe(3);
    expect(result.maxCount).toBe(2); // Two at Friday 10:00
  });

  it('identifies peak day and hour', () => {
    // Use local time strings to avoid timezone issues
    const monday = new Date(2026, 3, 6, 9, 0, 0); // April 6, 2026 9am local = Monday
    const tuesday = new Date(2026, 3, 7, 15, 0, 0); // April 7, 2026 3pm local = Tuesday
    const entries = [
      makeEntry(monday.toISOString()),
      makeEntry(monday.toISOString()),
      makeEntry(monday.toISOString()),
      makeEntry(tuesday.toISOString()),
    ];
    const result = generateHeatMap(entries);
    expect(result.peakDay).toBe('Mon');
    expect(result.peakHour).toBe(9);
    expect(result.maxCount).toBe(3);
  });

  it('calculates intensity relative to max', () => {
    const ts = new Date(2026, 3, 6, 9, 0, 0);
    const entries = [
      makeEntry(ts.toISOString()),
      makeEntry(ts.toISOString()),
    ];
    const result = generateHeatMap(entries);
    const peakCell = result.cells.find((c) => c.count === 2);
    expect(peakCell).toBeDefined();
    expect(peakCell!.intensity).toBe(1);

    const emptyCell = result.cells.find((c) => c.count === 0);
    expect(emptyCell).toBeDefined();
    expect(emptyCell!.intensity).toBe(0);
  });

  it('has correct grid dimensions', () => {
    const result = generateHeatMap([]);
    // Check that we have all 7 days × 24 hours
    const days = new Set(result.cells.map((c) => c.day));
    const hours = new Set(result.cells.map((c) => c.hour));
    expect(days.size).toBe(7);
    expect(hours.size).toBe(24);
  });

  it('skips entries with invalid timestamps', () => {
    const entries = [
      makeEntry('not-a-date'),
      makeEntry('2026-04-06T09:00:00.000Z'),
    ];
    const result = generateHeatMap(entries);
    expect(result.totalRecordings).toBe(2);
    expect(result.maxCount).toBe(1); // Only the valid one
  });
});

describe('formatHeatMap', () => {
  it('formats empty heat map', () => {
    const result = generateHeatMap([]);
    const text = formatHeatMap(result);
    expect(text).toContain('Recording Heat Map');
    expect(text).toContain('No recordings');
  });

  it('formats heat map with data', () => {
    const mon = new Date(2026, 3, 6, 9, 0, 0);
    const tue = new Date(2026, 3, 7, 15, 0, 0);
    const entries = [
      makeEntry(mon.toISOString()),
      makeEntry(mon.toISOString()),
      makeEntry(tue.toISOString()),
    ];
    const result = generateHeatMap(entries);
    const text = formatHeatMap(result);
    expect(text).toContain('Recording Heat Map');
    expect(text).toContain('Mon');
    expect(text).toContain('Tue');
    expect(text).toContain('Total: 3');
    expect(text).toContain('Peak:');
  });

  it('shows legend', () => {
    const ts = new Date(2026, 3, 6, 9, 0, 0);
    const entries = [makeEntry(ts.toISOString())];
    const result = generateHeatMap(entries);
    const text = formatHeatMap(result);
    expect(text).toContain('Legend:');
  });

  it('shows all day names', () => {
    const ts = new Date(2026, 3, 6, 9, 0, 0);
    const entries = [makeEntry(ts.toISOString())];
    const result = generateHeatMap(entries);
    const text = formatHeatMap(result);
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(text).toContain(day);
    }
  });
});
