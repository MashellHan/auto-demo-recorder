import { describe, it, expect } from 'vitest';
import { checkSla, formatSla } from '../src/analytics/sla.js';
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

describe('checkSla', () => {
  it('returns compliant for all-good data', () => {
    const entries = Array.from({ length: 10 }, () =>
      makeEntry({ status: 'ok', durationSeconds: 5, bugsFound: 0 }),
    );
    const result = checkSla(entries);
    expect(result.compliant).toBe(true);
    expect(result.passedCount).toBe(4);
  });

  it('detects failure rate violation', () => {
    const entries = [
      ...Array.from({ length: 8 }, () => makeEntry({ status: 'ok' })),
      ...Array.from({ length: 3 }, () => makeEntry({ status: 'error' })),
    ];
    const result = checkSla(entries);
    const successCheck = result.checks.find((c) => c.metric === 'Success Rate');
    expect(successCheck?.passed).toBe(false);
    expect(result.compliant).toBe(false);
  });

  it('detects duration violation', () => {
    const entries = [makeEntry({ durationSeconds: 60 })];
    const result = checkSla(entries);
    const durationCheck = result.checks.find((c) => c.metric === 'Avg Duration');
    expect(durationCheck?.passed).toBe(false);
  });

  it('detects bug violation', () => {
    const entries = [makeEntry({ bugsFound: 5 })];
    const result = checkSla(entries);
    const bugCheck = result.checks.find((c) => c.metric === 'Bugs/Run');
    expect(bugCheck?.passed).toBe(false);
  });

  it('detects recording count violation', () => {
    const result = checkSla([], { minRecordings: 5 });
    const countCheck = result.checks.find((c) => c.metric === 'Recording Count');
    expect(countCheck?.passed).toBe(false);
  });

  it('respects custom targets', () => {
    const entries = [makeEntry({ durationSeconds: 25 })];
    // Default max is 30 — passes
    expect(checkSla(entries).compliant).toBe(true);
    // Custom max is 20 — fails
    const result = checkSla(entries, { maxAvgDuration: 20 });
    expect(result.checks.find((c) => c.metric === 'Avg Duration')?.passed).toBe(false);
  });

  it('computes correct margin', () => {
    const entries = Array.from({ length: 10 }, () =>
      makeEntry({ status: 'ok', durationSeconds: 10 }),
    );
    const result = checkSla(entries, { minSuccessRate: 95 });
    const successCheck = result.checks.find((c) => c.metric === 'Success Rate');
    expect(successCheck?.margin).toBe(5); // 100% - 95% = +5
  });

  it('handles empty input', () => {
    const result = checkSla([]);
    expect(result.entriesAnalyzed).toBe(0);
    expect(result.totalChecks).toBe(4);
  });

  it('reports all 4 checks', () => {
    const result = checkSla([makeEntry()]);
    expect(result.checks.length).toBe(4);
    expect(result.checks.map((c) => c.metric)).toEqual([
      'Success Rate',
      'Avg Duration',
      'Bugs/Run',
      'Recording Count',
    ]);
  });
});

describe('formatSla', () => {
  it('formats compliant result', () => {
    const entries = Array.from({ length: 5 }, () => makeEntry());
    const result = checkSla(entries);
    const text = formatSla(result);
    expect(text).toContain('COMPLIANT');
    expect(text).toContain('4/4');
  });

  it('formats non-compliant result', () => {
    const entries = [makeEntry({ status: 'error' })];
    const result = checkSla(entries);
    const text = formatSla(result);
    expect(text).toContain('NON-COMPLIANT');
  });

  it('shows margin for each check', () => {
    const entries = [makeEntry()];
    const result = checkSla(entries);
    const text = formatSla(result);
    // Should have + or - margin for each check
    expect(text).toContain('+');
  });
});
