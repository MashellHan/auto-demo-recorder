import { describe, it, expect } from 'vitest';
import { evaluateRetention, formatRetention } from '../src/analytics/retention.js';
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

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('evaluateRetention', () => {
  it('returns no candidates for compliant data', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ timestamp: daysAgo(i), scenario: 'basic' }),
    );
    const result = evaluateRetention(entries);
    expect(result.candidates.length).toBe(0);
    expect(result.keepCount).toBe(5);
    expect(result.totalCount).toBe(5);
  });

  it('flags old recordings by age', () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(1) }),
      makeEntry({ timestamp: daysAgo(35) }),
      makeEntry({ timestamp: daysAgo(40) }),
    ];
    const result = evaluateRetention(entries, { maxAgeDays: 30 });
    expect(result.candidates.length).toBe(2);
    expect(result.candidates.every((c) => c.reason === 'age')).toBe(true);
    expect(result.keepCount).toBe(1);
  });

  it('keeps failed recordings when keepFailed is true', () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(35), status: 'error' }),
      makeEntry({ timestamp: daysAgo(35), status: 'ok' }),
    ];
    const result = evaluateRetention(entries, { maxAgeDays: 30, keepFailed: true });
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].entry.status).toBe('ok');
  });

  it('removes failed recordings when keepFailed is false', () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(35), status: 'error' }),
      makeEntry({ timestamp: daysAgo(35), status: 'ok' }),
    ];
    const result = evaluateRetention(entries, { maxAgeDays: 30, keepFailed: false });
    expect(result.candidates.length).toBe(2);
  });

  it('flags excess recordings by count', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ timestamp: daysAgo(i) }),
    );
    const result = evaluateRetention(entries, { maxCount: 5 });
    expect(result.candidates.length).toBe(5);
    expect(result.keepCount).toBe(5);
  });

  it('flags per-scenario excess', () => {
    const entries = Array.from({ length: 15 }, (_, i) =>
      makeEntry({ timestamp: daysAgo(i), scenario: 'basic' }),
    );
    const result = evaluateRetention(entries, {
      maxPerScenario: 10,
      minPerScenario: 5,
    });
    expect(result.candidates.length).toBe(5);
    expect(result.candidates.every((c) => c.reason === 'per_scenario_count')).toBe(true);
  });

  it('respects minPerScenario floor', () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ timestamp: daysAgo(i), scenario: 'basic' }),
    );
    const result = evaluateRetention(entries, {
      maxPerScenario: 3,
      minPerScenario: 5,
    });
    // Can't remove below minPerScenario so no removals
    expect(result.candidates.length).toBe(0);
  });

  it('provides per-scenario summary', () => {
    const entries = [
      makeEntry({ scenario: 'a', timestamp: daysAgo(1) }),
      makeEntry({ scenario: 'a', timestamp: daysAgo(2) }),
      makeEntry({ scenario: 'b', timestamp: daysAgo(35) }),
    ];
    const result = evaluateRetention(entries, { maxAgeDays: 30 });
    expect(result.scenarioSummary.length).toBe(2);
    const bSummary = result.scenarioSummary.find((s) => s.scenario === 'b');
    expect(bSummary?.remove).toBe(1);
  });

  it('handles empty input', () => {
    const result = evaluateRetention([]);
    expect(result.candidates.length).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.keepCount).toBe(0);
  });

  it('uses default policy values', () => {
    const result = evaluateRetention([makeEntry()]);
    expect(result.policy.maxAgeDays).toBe(30);
    expect(result.policy.maxCount).toBe(1000);
    expect(result.policy.maxPerScenario).toBe(100);
    expect(result.policy.minPerScenario).toBe(5);
    expect(result.policy.keepFailed).toBe(true);
  });

  it('does not let undefined policy values override defaults', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ timestamp: daysAgo(i) }),
    );
    // Passing undefined values should still use defaults (maxCount=1000)
    const result = evaluateRetention(entries, {
      maxCount: undefined,
      maxAgeDays: undefined,
    });
    expect(result.policy.maxCount).toBe(1000);
    expect(result.policy.maxAgeDays).toBe(30);
    // With default maxCount=1000 and only 10 entries, nothing should be removed
    expect(result.candidates.length).toBe(0);
  });

  it('throws on negative maxAgeDays', () => {
    expect(() => evaluateRetention([], { maxAgeDays: -1 })).toThrow('maxAgeDays must be a positive number');
  });

  it('throws on zero maxAgeDays', () => {
    expect(() => evaluateRetention([], { maxAgeDays: 0 })).toThrow('maxAgeDays must be a positive number');
  });

  it('throws on negative maxCount', () => {
    expect(() => evaluateRetention([], { maxCount: -5 })).toThrow('maxCount must be a positive number');
  });

  it('throws on zero maxCount', () => {
    expect(() => evaluateRetention([], { maxCount: 0 })).toThrow('maxCount must be a positive number');
  });

  it('throws on negative maxPerScenario', () => {
    expect(() => evaluateRetention([], { maxPerScenario: -1 })).toThrow('maxPerScenario must be a positive number');
  });

  it('multiple scenarios with independent limits', () => {
    const entries = [
      ...Array.from({ length: 8 }, (_, i) =>
        makeEntry({ scenario: 'a', timestamp: daysAgo(i) }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        makeEntry({ scenario: 'b', timestamp: daysAgo(i) }),
      ),
    ];
    const result = evaluateRetention(entries, { maxPerScenario: 5, minPerScenario: 3 });
    const aSummary = result.scenarioSummary.find((s) => s.scenario === 'a');
    const bSummary = result.scenarioSummary.find((s) => s.scenario === 'b');
    expect(aSummary?.keep).toBe(5);
    expect(bSummary?.keep).toBe(5);
  });
});

describe('formatRetention', () => {
  it('formats compliant result', () => {
    const result = evaluateRetention([makeEntry()]);
    const text = formatRetention(result);
    expect(text).toContain('Retention Policy Report');
    expect(text).toContain('All recordings comply');
  });

  it('formats result with candidates', () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(1) }),
      makeEntry({ timestamp: daysAgo(35) }),
    ];
    const result = evaluateRetention(entries, { maxAgeDays: 30 });
    const text = formatRetention(result);
    expect(text).toContain('Candidates for removal');
    expect(text).toContain('Expired');
    expect(text).toContain('Summary');
  });

  it('shows policy configuration', () => {
    const result = evaluateRetention([], { maxAgeDays: 7 });
    const text = formatRetention(result);
    expect(text).toContain('7 days');
  });
});
