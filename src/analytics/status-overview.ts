/**
 * Scenario status overview — aggregate per-scenario health
 * from recording history.
 *
 * Shows each scenario's latest status, total runs, success rate,
 * and average duration in a dashboard format.
 */

import type { HistoryEntry } from './history.js';

/** Per-scenario status overview. */
export interface ScenarioStatus {
  /** Scenario name. */
  readonly name: string;
  /** Latest status. */
  readonly latestStatus: string;
  /** Total recording count. */
  readonly totalRuns: number;
  /** Successful runs count. */
  readonly successCount: number;
  /** Success rate (0-100). */
  readonly successRate: number;
  /** Average duration in seconds. */
  readonly avgDuration: number;
  /** Latest recording timestamp. */
  readonly lastRecorded: string;
  /** Total bugs across all runs. */
  readonly totalBugs: number;
}

/** Overview result. */
export interface StatusOverview {
  /** Per-scenario statuses. */
  readonly scenarios: readonly ScenarioStatus[];
  /** Total unique scenarios. */
  readonly totalScenarios: number;
  /** Scenarios currently healthy (latest = ok). */
  readonly healthyCount: number;
  /** Scenarios currently failing (latest = error). */
  readonly failingCount: number;
}

/**
 * Compute per-scenario status from recording history.
 */
export function computeStatusOverview(entries: readonly HistoryEntry[]): StatusOverview {
  const byScenario = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const list = byScenario.get(entry.scenario) ?? [];
    list.push(entry);
    byScenario.set(entry.scenario, list);
  }

  const scenarios: ScenarioStatus[] = [];

  for (const [name, runs] of byScenario) {
    // Sort by timestamp descending
    runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latest = runs[0];
    const successCount = runs.filter((r) => r.status === 'ok').length;
    const totalDuration = runs.reduce((sum, r) => sum + r.durationSeconds, 0);
    const totalBugs = runs.reduce((sum, r) => sum + r.bugsFound, 0);

    scenarios.push({
      name,
      latestStatus: latest.status,
      totalRuns: runs.length,
      successCount,
      successRate: Math.round((successCount / runs.length) * 100),
      avgDuration: runs.length > 0 ? totalDuration / runs.length : 0,
      lastRecorded: latest.timestamp,
      totalBugs,
    });
  }

  // Sort by name
  scenarios.sort((a, b) => a.name.localeCompare(b.name));

  const healthyCount = scenarios.filter((s) => s.latestStatus === 'ok').length;
  const failingCount = scenarios.filter((s) => s.latestStatus === 'error' || s.latestStatus === 'fail').length;

  return {
    scenarios,
    totalScenarios: scenarios.length,
    healthyCount,
    failingCount,
  };
}

/**
 * Format status overview as a dashboard.
 */
export function formatStatusOverview(overview: StatusOverview): string {
  const lines: string[] = [];
  lines.push('Scenario Status Overview');
  lines.push('═'.repeat(60));
  lines.push('');

  if (overview.totalScenarios === 0) {
    lines.push('  No recording history found.');
    return lines.join('\n');
  }

  // Summary bar
  const healthPct = Math.round((overview.healthyCount / overview.totalScenarios) * 100);
  lines.push(`  Health: ${overview.healthyCount}/${overview.totalScenarios} healthy (${healthPct}%)  Failing: ${overview.failingCount}`);
  lines.push('');

  // Per-scenario table
  lines.push('  Scenario              Status  Runs  Success  Avg Duration  Bugs');
  lines.push('  ' + '─'.repeat(72));

  for (const s of overview.scenarios) {
    const icon = s.latestStatus === 'ok' ? '✓' : s.latestStatus === 'error' ? '✗' : '⚠';
    const name = s.name.padEnd(20).slice(0, 20);
    const status = `${icon} ${s.latestStatus.padEnd(5)}`;
    const runs = String(s.totalRuns).padStart(4);
    const success = `${s.successRate}%`.padStart(7);
    const dur = `${s.avgDuration.toFixed(1)}s`.padStart(12);
    const bugs = String(s.totalBugs).padStart(5);

    lines.push(`  ${name}  ${status}  ${runs}  ${success}  ${dur}  ${bugs}`);
  }

  lines.push('');
  return lines.join('\n');
}
