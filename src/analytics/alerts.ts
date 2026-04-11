/**
 * Scenario health alerts — generate alerts when scenario performance
 * metrics exceed configurable thresholds.
 *
 * Monitors: failure rate, average duration, bug density, and
 * recording frequency drops.
 */

import type { HistoryEntry } from './history.js';

/** Alert severity. */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/** A health alert. */
export interface HealthAlert {
  /** Alert severity. */
  readonly severity: AlertSeverity;
  /** Affected scenario. */
  readonly scenario: string;
  /** Alert type. */
  readonly type: 'failure-rate' | 'slow-duration' | 'high-bugs' | 'no-recent-runs';
  /** Human-readable message. */
  readonly message: string;
  /** Current metric value. */
  readonly value: number;
  /** Threshold that was exceeded. */
  readonly threshold: number;
}

/** Alert thresholds. */
export interface AlertThresholds {
  /** Maximum failure rate (0-1) before warning (default: 0.2). */
  readonly maxFailureRate?: number;
  /** Maximum failure rate before critical (default: 0.5). */
  readonly criticalFailureRate?: number;
  /** Maximum average duration in seconds before warning (default: 60). */
  readonly maxDuration?: number;
  /** Maximum average bugs per recording before warning (default: 5). */
  readonly maxBugsPerRun?: number;
  /** Maximum hours since last run before warning (default: 24). */
  readonly maxHoursSinceRun?: number;
}

/** Alert analysis result. */
export interface AlertResult {
  /** Generated alerts, sorted by severity. */
  readonly alerts: readonly HealthAlert[];
  /** Number of scenarios analyzed. */
  readonly scenariosAnalyzed: number;
  /** Number of scenarios with alerts. */
  readonly scenariosWithAlerts: number;
}

const DEFAULT_THRESHOLDS: Required<AlertThresholds> = {
  maxFailureRate: 0.2,
  criticalFailureRate: 0.5,
  maxDuration: 60,
  maxBugsPerRun: 5,
  maxHoursSinceRun: 24,
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Analyze recording history and generate health alerts.
 */
export function generateAlerts(
  entries: readonly HistoryEntry[],
  thresholds: AlertThresholds = {},
): AlertResult {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // Group by scenario
  const scenarios = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const list = scenarios.get(entry.scenario) ?? [];
    list.push(entry);
    scenarios.set(entry.scenario, list);
  }

  const alerts: HealthAlert[] = [];
  const now = Date.now();

  for (const [scenario, scenarioEntries] of scenarios) {
    // Failure rate
    const failCount = scenarioEntries.filter((e) => e.status !== 'ok').length;
    const failureRate = failCount / scenarioEntries.length;

    if (failureRate >= t.criticalFailureRate) {
      alerts.push({
        severity: 'critical',
        scenario,
        type: 'failure-rate',
        message: `${Math.round(failureRate * 100)}% failure rate (${failCount}/${scenarioEntries.length})`,
        value: failureRate,
        threshold: t.criticalFailureRate,
      });
    } else if (failureRate >= t.maxFailureRate) {
      alerts.push({
        severity: 'warning',
        scenario,
        type: 'failure-rate',
        message: `${Math.round(failureRate * 100)}% failure rate (${failCount}/${scenarioEntries.length})`,
        value: failureRate,
        threshold: t.maxFailureRate,
      });
    }

    // Average duration
    const avgDuration = scenarioEntries.reduce((sum, e) => sum + e.durationSeconds, 0) / scenarioEntries.length;
    if (avgDuration > t.maxDuration) {
      alerts.push({
        severity: 'warning',
        scenario,
        type: 'slow-duration',
        message: `Average duration ${avgDuration.toFixed(1)}s exceeds ${t.maxDuration}s threshold`,
        value: avgDuration,
        threshold: t.maxDuration,
      });
    }

    // Bug density
    const avgBugs = scenarioEntries.reduce((sum, e) => sum + e.bugsFound, 0) / scenarioEntries.length;
    if (avgBugs > t.maxBugsPerRun) {
      alerts.push({
        severity: 'warning',
        scenario,
        type: 'high-bugs',
        message: `Average ${avgBugs.toFixed(1)} bugs per run exceeds ${t.maxBugsPerRun} threshold`,
        value: avgBugs,
        threshold: t.maxBugsPerRun,
      });
    }

    // Recent activity
    const latestTs = Math.max(...scenarioEntries.map((e) => new Date(e.timestamp).getTime()));
    const hoursSinceRun = (now - latestTs) / (1000 * 60 * 60);
    if (hoursSinceRun > t.maxHoursSinceRun) {
      alerts.push({
        severity: 'info',
        scenario,
        type: 'no-recent-runs',
        message: `No recordings in ${Math.round(hoursSinceRun)} hours (threshold: ${t.maxHoursSinceRun}h)`,
        value: hoursSinceRun,
        threshold: t.maxHoursSinceRun,
      });
    }
  }

  // Sort by severity
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const scenariosWithAlerts = new Set(alerts.map((a) => a.scenario)).size;

  return {
    alerts,
    scenariosAnalyzed: scenarios.size,
    scenariosWithAlerts,
  };
}

/**
 * Format health alert results.
 */
export function formatAlerts(result: AlertResult): string {
  const lines: string[] = [];
  lines.push('Scenario Health Alerts');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.alerts.length === 0) {
    lines.push('  ✓ All scenarios are healthy.');
    lines.push(`  Monitored: ${result.scenariosAnalyzed} scenario(s)`);
    return lines.join('\n');
  }

  const criticals = result.alerts.filter((a) => a.severity === 'critical');
  const warnings = result.alerts.filter((a) => a.severity === 'warning');
  const infos = result.alerts.filter((a) => a.severity === 'info');

  if (criticals.length > 0) {
    lines.push('  🔴 CRITICAL:');
    for (const a of criticals) {
      lines.push(`    [${a.scenario}] ${a.message}`);
    }
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('  🟡 WARNING:');
    for (const a of warnings) {
      lines.push(`    [${a.scenario}] ${a.message}`);
    }
    lines.push('');
  }

  if (infos.length > 0) {
    lines.push('  🔵 INFO:');
    for (const a of infos) {
      lines.push(`    [${a.scenario}] ${a.message}`);
    }
    lines.push('');
  }

  lines.push(`  Summary: ${result.alerts.length} alert(s) across ${result.scenariosWithAlerts}/${result.scenariosAnalyzed} scenario(s)`);
  return lines.join('\n');
}
