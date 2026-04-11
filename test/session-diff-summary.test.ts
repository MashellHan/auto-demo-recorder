import { describe, it, expect } from 'vitest';
import { diffSessionEntries, formatSessionDiffSummary } from '../src/analytics/session-diff-summary.js';
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

describe('diffSessionEntries', () => {
  it('detects stable-ok scenarios', () => {
    const a = [makeEntry({ scenario: 'basic', status: 'ok' })];
    const b = [makeEntry({ scenario: 'basic', status: 'ok' })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].transition).toBe('stable-ok');
    expect(result.summary.stableOk).toBe(1);
  });

  it('detects broken scenarios', () => {
    const a = [makeEntry({ scenario: 'basic', status: 'ok' })];
    const b = [makeEntry({ scenario: 'basic', status: 'error' })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].transition).toBe('broken');
    expect(result.summary.broken).toBe(1);
  });

  it('detects fixed scenarios', () => {
    const a = [makeEntry({ scenario: 'basic', status: 'error' })];
    const b = [makeEntry({ scenario: 'basic', status: 'ok' })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].transition).toBe('fixed');
    expect(result.summary.fixed).toBe(1);
  });

  it('detects stable-error scenarios', () => {
    const a = [makeEntry({ scenario: 'basic', status: 'error' })];
    const b = [makeEntry({ scenario: 'basic', status: 'error' })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].transition).toBe('stable-error');
    expect(result.summary.stableError).toBe(1);
  });

  it('detects new scenarios', () => {
    const a: HistoryEntry[] = [];
    const b = [makeEntry({ scenario: 'new-test' })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].transition).toBe('new');
    expect(result.summary.newScenarios).toBe(1);
  });

  it('detects removed scenarios', () => {
    const a = [makeEntry({ scenario: 'old-test' })];
    const b: HistoryEntry[] = [];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].transition).toBe('removed');
    expect(result.summary.removed).toBe(1);
  });

  it('computes duration delta', () => {
    const a = [makeEntry({ scenario: 'basic', durationSeconds: 10 })];
    const b = [makeEntry({ scenario: 'basic', durationSeconds: 15 })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].durationDelta).toBe(5);
    expect(result.diffs[0].durationPct).toBe(50);
  });

  it('computes negative duration delta', () => {
    const a = [makeEntry({ scenario: 'basic', durationSeconds: 20 })];
    const b = [makeEntry({ scenario: 'basic', durationSeconds: 10 })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].durationDelta).toBe(-10);
    expect(result.diffs[0].durationPct).toBe(-50);
  });

  it('computes average duration delta', () => {
    const a = [
      makeEntry({ scenario: 'a', durationSeconds: 10 }),
      makeEntry({ scenario: 'b', durationSeconds: 20 }),
    ];
    const b = [
      makeEntry({ scenario: 'a', durationSeconds: 15 }),
      makeEntry({ scenario: 'b', durationSeconds: 25 }),
    ];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.summary.avgDurationDelta).toBe(5);
  });

  it('tracks bug count changes', () => {
    const a = [makeEntry({ scenario: 'basic', bugsFound: 2 })];
    const b = [makeEntry({ scenario: 'basic', bugsFound: 0 })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].bugsA).toBe(2);
    expect(result.diffs[0].bugsB).toBe(0);
  });

  it('sorts by transition severity', () => {
    const a = [
      makeEntry({ scenario: 'ok-stays', status: 'ok' }),
      makeEntry({ scenario: 'breaks', status: 'ok' }),
      makeEntry({ scenario: 'gets-fixed', status: 'error' }),
    ];
    const b = [
      makeEntry({ scenario: 'ok-stays', status: 'ok' }),
      makeEntry({ scenario: 'breaks', status: 'error' }),
      makeEntry({ scenario: 'gets-fixed', status: 'ok' }),
    ];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.diffs[0].transition).toBe('broken');
    expect(result.diffs[1].transition).toBe('fixed');
    expect(result.diffs[2].transition).toBe('stable-ok');
  });

  it('handles empty sessions', () => {
    const result = diffSessionEntries([], [], 's1', 's2');
    expect(result.diffs.length).toBe(0);
    expect(result.summary.total).toBe(0);
  });

  it('preserves session identifiers', () => {
    const result = diffSessionEntries([], [], 'session-A', 'session-B');
    expect(result.sessionA).toBe('session-A');
    expect(result.sessionB).toBe('session-B');
  });

  it('handles complex multi-scenario diff', () => {
    const a = [
      makeEntry({ scenario: 'stable', status: 'ok', durationSeconds: 10 }),
      makeEntry({ scenario: 'will-break', status: 'ok', durationSeconds: 5 }),
      makeEntry({ scenario: 'to-remove', status: 'ok', durationSeconds: 8 }),
    ];
    const b = [
      makeEntry({ scenario: 'stable', status: 'ok', durationSeconds: 12 }),
      makeEntry({ scenario: 'will-break', status: 'error', durationSeconds: 15 }),
      makeEntry({ scenario: 'brand-new', status: 'ok', durationSeconds: 7 }),
    ];
    const result = diffSessionEntries(a, b, 's1', 's2');
    expect(result.summary.total).toBe(4);
    expect(result.summary.stableOk).toBe(1);
    expect(result.summary.broken).toBe(1);
    expect(result.summary.newScenarios).toBe(1);
    expect(result.summary.removed).toBe(1);
  });
});

describe('formatSessionDiffSummary', () => {
  it('formats empty diff', () => {
    const result = diffSessionEntries([], [], 's1', 's2');
    const text = formatSessionDiffSummary(result);
    expect(text).toContain('Session Diff Summary');
    expect(text).toContain('No scenarios found');
  });

  it('formats diff with transitions', () => {
    const a = [
      makeEntry({ scenario: 'basic', status: 'ok', durationSeconds: 10 }),
      makeEntry({ scenario: 'broken', status: 'ok', durationSeconds: 5 }),
    ];
    const b = [
      makeEntry({ scenario: 'basic', status: 'ok', durationSeconds: 12 }),
      makeEntry({ scenario: 'broken', status: 'error', durationSeconds: 15 }),
    ];
    const result = diffSessionEntries(a, b, 'session-1', 'session-2');
    const text = formatSessionDiffSummary(result);
    expect(text).toContain('session-1');
    expect(text).toContain('session-2');
    expect(text).toContain('broken');
    expect(text).toContain('stable');
    expect(text).toContain('Summary');
  });

  it('shows duration changes', () => {
    const a = [makeEntry({ scenario: 'basic', durationSeconds: 10 })];
    const b = [makeEntry({ scenario: 'basic', durationSeconds: 15 })];
    const result = diffSessionEntries(a, b, 's1', 's2');
    const text = formatSessionDiffSummary(result);
    expect(text).toContain('+5');
    expect(text).toContain('50%');
  });
});
