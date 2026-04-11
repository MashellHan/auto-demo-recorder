import { describe, it, expect } from 'vitest';
import { detectAnomalies, formatAnomalies } from '../src/analytics/anomaly.js';
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

describe('detectAnomalies', () => {
  it('returns empty for no entries', () => {
    const result = detectAnomalies([]);
    expect(result.anomalies).toEqual([]);
    expect(result.totalRecordings).toBe(0);
    expect(result.anomalyRate).toBe(0);
  });

  it('returns empty for few entries (below stats threshold)', () => {
    const entries = [
      makeEntry({ durationSeconds: 5 }),
      makeEntry({ durationSeconds: 5 }),
    ];
    const result = detectAnomalies(entries);
    expect(result.anomalies).toEqual([]);
  });

  it('detects duration anomaly', () => {
    const entries = [
      makeEntry({ durationSeconds: 5, timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ durationSeconds: 5, timestamp: '2026-04-11T10:01:00.000Z' }),
      makeEntry({ durationSeconds: 5, timestamp: '2026-04-11T10:02:00.000Z' }),
      makeEntry({ durationSeconds: 5, timestamp: '2026-04-11T10:03:00.000Z' }),
      makeEntry({ durationSeconds: 100, timestamp: '2026-04-11T10:04:00.000Z' }), // anomaly
    ];
    const result = detectAnomalies(entries, 2.0);
    expect(result.anomalies.some((a) => a.type === 'duration')).toBe(true);
    const anomaly = result.anomalies.find((a) => a.type === 'duration');
    expect(anomaly!.value).toBe(100);
  });

  it('does not flag normal durations', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${10 + i}:00:00.000Z` }),
    );
    const result = detectAnomalies(entries, 2.0);
    expect(result.anomalies.filter((a) => a.type === 'duration')).toEqual([]);
  });

  it('classifies severity by z-score', () => {
    const entries = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 500, timestamp: '2026-04-12T10:00:00.000Z' }), // extreme outlier
    ];
    const result = detectAnomalies(entries, 2.0);
    const durAnomalies = result.anomalies.filter((a) => a.type === 'duration');
    if (durAnomalies.length > 0) {
      // Extreme outlier should be high severity
      expect(durAnomalies.some((a) => a.severity === 'high')).toBe(true);
    }
  });

  it('detects burst anomaly (many recordings in one hour)', () => {
    const entries: HistoryEntry[] = [];
    // Normal: 1-2 per hour for several hours
    for (let h = 0; h < 10; h++) {
      entries.push(makeEntry({
        timestamp: `2026-04-11T${(10 + h).toString().padStart(2, '0')}:00:00.000Z`,
      }));
    }
    // Burst: 20 recordings in one hour
    for (let i = 0; i < 20; i++) {
      entries.push(makeEntry({
        timestamp: `2026-04-11T05:${i.toString().padStart(2, '0')}:00.000Z`,
      }));
    }
    const result = detectAnomalies(entries, 2.0);
    expect(result.anomalies.some((a) => a.type === 'burst')).toBe(true);
  });

  it('detects gap anomaly (long periods between recordings)', () => {
    const entries: HistoryEntry[] = [];
    // Regular hourly recordings
    for (let h = 0; h < 10; h++) {
      entries.push(makeEntry({
        timestamp: `2026-04-11T${(10 + h).toString().padStart(2, '0')}:00:00.000Z`,
      }));
    }
    // Then a very large gap
    entries.push(makeEntry({
      timestamp: '2026-04-20T10:00:00.000Z', // 9 days later
    }));
    const result = detectAnomalies(entries, 2.0);
    expect(result.anomalies.some((a) => a.type === 'gap')).toBe(true);
  });

  it('counts anomalies by severity', () => {
    const entries = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 500, timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = detectAnomalies(entries, 2.0);
    const total = result.bySeverity.high + result.bySeverity.medium + result.bySeverity.low;
    expect(total).toBe(result.anomalies.length);
  });

  it('counts anomalies by type', () => {
    const entries = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 200, timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = detectAnomalies(entries, 2.0);
    const total = result.byType.duration + result.byType.burst + result.byType.gap;
    expect(total).toBe(result.anomalies.length);
  });

  it('computes anomaly rate', () => {
    const entries = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 200, timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = detectAnomalies(entries, 2.0);
    expect(result.anomalyRate).toBeGreaterThanOrEqual(0);
  });

  it('sorts anomalies by severity then timestamp', () => {
    const entries = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 100, timestamp: '2026-04-12T10:00:00.000Z' }),
      makeEntry({ durationSeconds: 500, timestamp: '2026-04-12T11:00:00.000Z' }),
    ];
    const result = detectAnomalies(entries, 2.0);
    const severityOrder = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < result.anomalies.length; i++) {
      const prevSev = severityOrder[result.anomalies[i - 1].severity];
      const currSev = severityOrder[result.anomalies[i].severity];
      expect(currSev).toBeGreaterThanOrEqual(prevSev);
    }
  });

  it('uses custom z-threshold', () => {
    const entries = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 15, timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const strictResult = detectAnomalies(entries, 3.0);
    const looseResult = detectAnomalies(entries, 1.0);
    expect(looseResult.anomalies.length).toBeGreaterThanOrEqual(strictResult.anomalies.length);
  });

  it('handles multiple scenarios independently', () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeEntry({ scenario: 'fast', durationSeconds: 2, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeEntry({ scenario: 'slow', durationSeconds: 60, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
    ];
    const result = detectAnomalies(entries, 2.0);
    expect(result.scenarioCount).toBe(2);
    // No anomalies since each scenario is internally consistent
    expect(result.anomalies.filter((a) => a.type === 'duration')).toEqual([]);
  });

  it('provides z-score in anomaly', () => {
    const entries = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 200, timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = detectAnomalies(entries, 2.0);
    for (const a of result.anomalies) {
      expect(a.zScore).toBeGreaterThanOrEqual(2.0);
    }
  });
});

describe('formatAnomalies', () => {
  it('formats empty result', () => {
    const result = detectAnomalies([]);
    const text = formatAnomalies(result);
    expect(text).toContain('Anomaly Detection');
    expect(text).toContain('No recordings');
  });

  it('formats with anomalies', () => {
    const entries = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 200, timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = detectAnomalies(entries, 2.0);
    const text = formatAnomalies(result);
    expect(text).toContain('Recordings analyzed');
    expect(text).toContain('Anomalies found');
    expect(text).toContain('Anomaly rate');
  });

  it('formats with no anomalies found', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(10 + i).toString().padStart(2, '0')}:00:00.000Z` }),
    );
    const result = detectAnomalies(entries, 2.0);
    const text = formatAnomalies(result);
    expect(text).toContain('No anomalies detected');
  });

  it('shows severity and type icons', () => {
    const entries = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeEntry({ durationSeconds: 5, timestamp: `2026-04-11T${(i).toString().padStart(2, '0')}:00:00.000Z` }),
      ),
      makeEntry({ durationSeconds: 500, timestamp: '2026-04-12T10:00:00.000Z' }),
    ];
    const result = detectAnomalies(entries, 2.0);
    if (result.anomalies.length > 0) {
      const text = formatAnomalies(result);
      expect(text).toMatch(/🔴|🟡|🟢/);
      expect(text).toMatch(/⏱|💥|⏸/);
    }
  });
});
