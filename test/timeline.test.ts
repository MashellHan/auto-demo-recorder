import { describe, it, expect } from 'vitest';
import { generateTimeline, formatTimeline } from '../src/analytics/timeline.js';
import type { HistoryEntry } from '../src/analytics/history.js';

const sampleEntries: HistoryEntry[] = [
  {
    timestamp: '2026-04-11T10:00:00Z',
    sessionId: '2026-04-11_10-00',
    scenario: 'hello-world',
    status: 'success',
    durationSeconds: 15,
    bugsFound: 0,
    backend: 'vhs',
  },
  {
    timestamp: '2026-04-11T10:05:00Z',
    sessionId: '2026-04-11_10-05',
    scenario: 'complex-demo',
    status: 'success',
    durationSeconds: 45,
    bugsFound: 2,
    backend: 'vhs',
  },
  {
    timestamp: '2026-04-11T10:10:00Z',
    sessionId: '2026-04-11_10-10',
    scenario: 'browser-test',
    status: 'failed',
    durationSeconds: 8,
    bugsFound: 0,
    backend: 'browser',
  },
];

describe('generateTimeline', () => {
  it('returns empty result for no entries', () => {
    const result = generateTimeline([]);
    expect(result.entries).toHaveLength(0);
    expect(result.totalDurationSeconds).toBe(0);
    expect(result.longest).toBeNull();
    expect(result.shortest).toBeNull();
  });

  it('generates timeline entries', () => {
    const result = generateTimeline(sampleEntries);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].scenario).toBe('hello-world');
    expect(result.entries[1].scenario).toBe('complex-demo');
    expect(result.entries[2].scenario).toBe('browser-test');
  });

  it('sorts entries chronologically', () => {
    const reversed = [...sampleEntries].reverse();
    const result = generateTimeline(reversed);
    expect(result.entries[0].timestamp).toBe('2026-04-11T10:00:00Z');
    expect(result.entries[2].timestamp).toBe('2026-04-11T10:10:00Z');
  });

  it('calculates total and average duration', () => {
    const result = generateTimeline(sampleEntries);
    expect(result.totalDurationSeconds).toBe(68); // 15 + 45 + 8
    expect(result.avgDurationSeconds).toBe(23); // round(68 / 3)
  });

  it('identifies longest and shortest', () => {
    const result = generateTimeline(sampleEntries);
    expect(result.longest!.scenario).toBe('complex-demo');
    expect(result.longest!.durationSeconds).toBe(45);
    expect(result.shortest!.scenario).toBe('browser-test');
    expect(result.shortest!.durationSeconds).toBe(8);
  });

  it('generates duration bars', () => {
    const result = generateTimeline(sampleEntries);
    // Longest entry should have full bar
    expect(result.entries[1].bar).toContain('█');
    // All bars should be same total length
    expect(result.entries[0].bar.length).toBe(result.entries[1].bar.length);
    expect(result.entries[1].bar.length).toBe(result.entries[2].bar.length);
  });

  it('handles single entry', () => {
    const result = generateTimeline([sampleEntries[0]]);
    expect(result.entries).toHaveLength(1);
    expect(result.longest!.scenario).toBe('hello-world');
    expect(result.shortest!.scenario).toBe('hello-world');
    expect(result.avgDurationSeconds).toBe(15);
  });
});

describe('formatTimeline', () => {
  it('formats empty timeline', () => {
    const result = generateTimeline([]);
    const text = formatTimeline(result);
    expect(text).toContain('No recording history');
  });

  it('formats timeline with entries', () => {
    const result = generateTimeline(sampleEntries);
    const text = formatTimeline(result);
    expect(text).toContain('Recording Timeline');
    expect(text).toContain('hello-world');
    expect(text).toContain('complex-demo');
    expect(text).toContain('browser-test');
    expect(text).toContain('Total: 3 recordings');
    expect(text).toContain('Longest: complex-demo');
    expect(text).toContain('Shortest: browser-test');
  });

  it('shows status icons', () => {
    const result = generateTimeline(sampleEntries);
    const text = formatTimeline(result);
    expect(text).toContain('✓'); // success
    expect(text).toContain('✗'); // failed
  });

  it('shows backend label', () => {
    const result = generateTimeline(sampleEntries);
    const text = formatTimeline(result);
    expect(text).toContain('[vhs]');
    expect(text).toContain('[browser]');
  });
});
