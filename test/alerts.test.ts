import { describe, it, expect } from 'vitest';
import { generateAlerts, formatAlerts } from '../src/analytics/alerts.js';
import type { HistoryEntry } from '../src/analytics/history.js';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: new Date().toISOString(),
    sessionId: '2026-04-11_10-00',
    scenario: 'basic',
    status: 'ok',
    durationSeconds: 12.5,
    bugsFound: 0,
    backend: 'vhs',
    ...overrides,
  };
}

describe('generateAlerts', () => {
  it('returns no alerts for healthy scenarios', () => {
    const entries = Array.from({ length: 10 }, () => makeEntry());
    const result = generateAlerts(entries);
    expect(result.alerts.filter((a) => a.type !== 'no-recent-runs').length).toBe(0);
    expect(result.scenariosAnalyzed).toBe(1);
  });

  it('detects critical failure rate', () => {
    const entries = [
      ...Array.from({ length: 5 }, () => makeEntry({ status: 'ok' })),
      ...Array.from({ length: 6 }, () => makeEntry({ status: 'error' })),
    ];
    const result = generateAlerts(entries);
    const critical = result.alerts.find(
      (a) => a.severity === 'critical' && a.type === 'failure-rate',
    );
    expect(critical).toBeDefined();
  });

  it('detects warning failure rate', () => {
    const entries = [
      ...Array.from({ length: 7 }, () => makeEntry({ status: 'ok' })),
      ...Array.from({ length: 3 }, () => makeEntry({ status: 'error' })),
    ];
    const result = generateAlerts(entries);
    const warning = result.alerts.find(
      (a) => a.severity === 'warning' && a.type === 'failure-rate',
    );
    expect(warning).toBeDefined();
    expect(warning!.value).toBeCloseTo(0.3);
  });

  it('detects slow duration', () => {
    const entries = [makeEntry({ durationSeconds: 120 })];
    const result = generateAlerts(entries);
    const slow = result.alerts.find((a) => a.type === 'slow-duration');
    expect(slow).toBeDefined();
    expect(slow!.severity).toBe('warning');
  });

  it('detects high bugs', () => {
    const entries = [makeEntry({ bugsFound: 10 })];
    const result = generateAlerts(entries);
    const bugs = result.alerts.find((a) => a.type === 'high-bugs');
    expect(bugs).toBeDefined();
  });

  it('detects no recent runs', () => {
    const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const entries = [makeEntry({ timestamp: oldTimestamp })];
    const result = generateAlerts(entries);
    const stale = result.alerts.find((a) => a.type === 'no-recent-runs');
    expect(stale).toBeDefined();
    expect(stale!.severity).toBe('info');
  });

  it('respects custom thresholds', () => {
    const entries = [makeEntry({ durationSeconds: 30 })];
    // Default maxDuration is 60, so 30 is ok
    const defaultResult = generateAlerts(entries);
    expect(defaultResult.alerts.find((a) => a.type === 'slow-duration')).toBeUndefined();

    // Custom maxDuration of 20
    const strictResult = generateAlerts(entries, { maxDuration: 20 });
    expect(strictResult.alerts.find((a) => a.type === 'slow-duration')).toBeDefined();
  });

  it('analyzes multiple scenarios independently', () => {
    const entries = [
      makeEntry({ scenario: 'healthy', status: 'ok' }),
      makeEntry({ scenario: 'sick', status: 'error' }),
      makeEntry({ scenario: 'sick', status: 'error' }),
    ];
    const result = generateAlerts(entries, { criticalFailureRate: 0.5 });
    const sickAlerts = result.alerts.filter((a) => a.scenario === 'sick');
    expect(sickAlerts.length).toBeGreaterThanOrEqual(1);
    expect(result.scenariosAnalyzed).toBe(2);
  });

  it('sorts alerts by severity (critical first)', () => {
    const entries = [
      makeEntry({ scenario: 'failing', status: 'error' }),
      makeEntry({ scenario: 'slow', status: 'ok', durationSeconds: 120 }),
    ];
    const result = generateAlerts(entries, { criticalFailureRate: 0.5 });
    if (result.alerts.length >= 2) {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      for (let i = 0; i < result.alerts.length - 1; i++) {
        expect(severityOrder[result.alerts[i].severity]).toBeLessThanOrEqual(
          severityOrder[result.alerts[i + 1].severity],
        );
      }
    }
  });

  it('handles empty input', () => {
    const result = generateAlerts([]);
    expect(result.alerts.length).toBe(0);
    expect(result.scenariosAnalyzed).toBe(0);
  });

  it('counts scenarios with alerts', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'error' }),
      makeEntry({ scenario: 'b', status: 'ok' }),
      makeEntry({ scenario: 'c', status: 'error' }),
    ];
    const result = generateAlerts(entries, { criticalFailureRate: 0.5 });
    expect(result.scenariosWithAlerts).toBeGreaterThanOrEqual(2);
  });
});

describe('formatAlerts', () => {
  it('formats healthy output', () => {
    const entries = Array.from({ length: 5 }, () => makeEntry());
    const result = generateAlerts(entries, { maxHoursSinceRun: 9999 });
    const text = formatAlerts(result);
    expect(text).toContain('healthy');
  });

  it('formats critical alerts with icon', () => {
    const entries = [makeEntry({ status: 'error' })];
    const result = generateAlerts(entries, { criticalFailureRate: 0.5 });
    const text = formatAlerts(result);
    expect(text).toContain('CRITICAL');
  });

  it('formats summary', () => {
    const entries = [
      makeEntry({ scenario: 'a', status: 'error' }),
      makeEntry({ scenario: 'b', durationSeconds: 120 }),
    ];
    const result = generateAlerts(entries);
    const text = formatAlerts(result);
    expect(text).toContain('alert(s)');
    expect(text).toContain('scenario(s)');
  });
});
