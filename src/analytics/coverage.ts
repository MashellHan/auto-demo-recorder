/**
 * Scenario coverage report — cross-reference config scenarios
 * with recording history to identify which scenarios have been
 * recorded, which are stale, and which have never been recorded.
 */

import type { HistoryEntry } from './history.js';

/** Coverage status for a scenario. */
export type CoverageStatus = 'covered' | 'stale' | 'never-recorded';

/** Coverage info for a single scenario. */
export interface ScenarioCoverage {
  /** Scenario name. */
  readonly scenario: string;
  /** Coverage status. */
  readonly status: CoverageStatus;
  /** Number of recordings. */
  readonly recordingCount: number;
  /** Last recorded timestamp (undefined if never recorded). */
  readonly lastRecorded?: string;
  /** Days since last recording (undefined if never recorded). */
  readonly daysSinceRecording?: number;
  /** Success rate (0-1, undefined if never recorded). */
  readonly successRate?: number;
}

/** Coverage report result. */
export interface CoverageReport {
  /** Per-scenario coverage data. */
  readonly scenarios: readonly ScenarioCoverage[];
  /** Overall coverage percentage (0-100). */
  readonly coveragePercent: number;
  /** Summary counts. */
  readonly summary: {
    readonly total: number;
    readonly covered: number;
    readonly stale: number;
    readonly neverRecorded: number;
  };
}

/**
 * Compute coverage report for configured scenarios against history.
 *
 * @param configuredScenarios List of scenario names from the config
 * @param entries Recording history entries
 * @param staleDays Number of days after which a scenario is considered stale (default: 7)
 * @param now Reference time for age calculations
 */
export function computeCoverage(
  configuredScenarios: readonly string[],
  entries: readonly HistoryEntry[],
  staleDays: number = 7,
  now: Date = new Date(),
): CoverageReport {
  const nowMs = now.getTime();
  const staleMs = staleDays * 24 * 60 * 60 * 1000;

  // Group entries by scenario
  const groups = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.scenario) ?? [];
    list.push(e);
    groups.set(e.scenario, list);
  }

  const scenarios: ScenarioCoverage[] = [];

  for (const scenario of configuredScenarios) {
    const group = groups.get(scenario);

    if (!group || group.length === 0) {
      scenarios.push({
        scenario,
        status: 'never-recorded',
        recordingCount: 0,
      });
      continue;
    }

    const timestamps = group.map((e) => new Date(e.timestamp).getTime());
    const latest = Math.max(...timestamps);
    const daysSince = (nowMs - latest) / (1000 * 60 * 60 * 24);
    const okCount = group.filter((e) => e.status === 'ok').length;

    const status: CoverageStatus = daysSince > staleDays ? 'stale' : 'covered';

    scenarios.push({
      scenario,
      status,
      recordingCount: group.length,
      lastRecorded: new Date(latest).toISOString(),
      daysSinceRecording: Math.round(daysSince * 10) / 10,
      successRate: Math.round((okCount / group.length) * 1000) / 1000,
    });
  }

  scenarios.sort((a, b) => {
    const statusOrder: Record<CoverageStatus, number> = {
      'never-recorded': 0, 'stale': 1, 'covered': 2,
    };
    return statusOrder[a.status] - statusOrder[b.status] || a.scenario.localeCompare(b.scenario);
  });

  const covered = scenarios.filter((s) => s.status === 'covered').length;
  const staleCount = scenarios.filter((s) => s.status === 'stale').length;
  const neverRecorded = scenarios.filter((s) => s.status === 'never-recorded').length;
  const total = scenarios.length;
  const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 0;

  return {
    scenarios,
    coveragePercent,
    summary: { total, covered, stale: staleCount, neverRecorded },
  };
}

/**
 * Format coverage report.
 */
export function formatCoverage(report: CoverageReport): string {
  const lines: string[] = [];
  lines.push('Scenario Coverage Report');
  lines.push('═'.repeat(60));
  lines.push('');

  if (report.scenarios.length === 0) {
    lines.push('  No scenarios configured.');
    return lines.join('\n');
  }

  const icons: Record<CoverageStatus, string> = {
    'covered': '✓', 'stale': '⚠', 'never-recorded': '✗',
  };

  lines.push(`  Coverage: ${report.coveragePercent}%`);
  lines.push(`  ${report.summary.covered} covered, ${report.summary.stale} stale, ${report.summary.neverRecorded} never recorded (of ${report.summary.total})`);
  lines.push('');

  lines.push(`  ${'Scenario'.padEnd(22)} ${'Status'.padStart(16)} ${'Recordings'.padStart(12)} ${'Last'.padStart(14)}`);
  lines.push('  ' + '─'.repeat(66));

  for (const s of report.scenarios) {
    const icon = icons[s.status];
    const last = s.daysSinceRecording !== undefined
      ? `${s.daysSinceRecording}d ago`
      : 'never';
    lines.push(`  ${s.scenario.padEnd(22)} ${(icon + ' ' + s.status).padStart(16)} ${s.recordingCount.toString().padStart(12)} ${last.padStart(14)}`);
  }

  lines.push('');
  return lines.join('\n');
}
