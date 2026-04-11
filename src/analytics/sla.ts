/**
 * SLA compliance monitoring — verify recording performance meets
 * defined Service Level Agreement targets.
 *
 * Configurable targets:
 * - Uptime (success rate percentage)
 * - Maximum recording duration
 * - Maximum bugs per recording
 * - Minimum recordings per period
 */

import type { HistoryEntry } from './history.js';

/** SLA target definition. */
export interface SlaTarget {
  /** Minimum success rate (0-100, default: 95). */
  readonly minSuccessRate?: number;
  /** Maximum average duration in seconds (default: 30). */
  readonly maxAvgDuration?: number;
  /** Maximum bugs per recording (default: 0). */
  readonly maxBugsPerRun?: number;
  /** Minimum total recordings required (default: 1). */
  readonly minRecordings?: number;
}

/** SLA check result for a single metric. */
export interface SlaCheck {
  /** Metric name. */
  readonly metric: string;
  /** Whether this check passed. */
  readonly passed: boolean;
  /** Current value. */
  readonly actual: number;
  /** Target value. */
  readonly target: number;
  /** Margin (actual vs target, positive = good). */
  readonly margin: number;
}

/** Overall SLA compliance result. */
export interface SlaResult {
  /** Individual check results. */
  readonly checks: readonly SlaCheck[];
  /** Whether all checks passed. */
  readonly compliant: boolean;
  /** Number of checks passed. */
  readonly passedCount: number;
  /** Total checks. */
  readonly totalChecks: number;
  /** Entries analyzed. */
  readonly entriesAnalyzed: number;
}

const DEFAULTS: Required<SlaTarget> = {
  minSuccessRate: 95,
  maxAvgDuration: 30,
  maxBugsPerRun: 0,
  minRecordings: 1,
};

/**
 * Check SLA compliance against recording history.
 */
export function checkSla(
  entries: readonly HistoryEntry[],
  targets: SlaTarget = {},
): SlaResult {
  const t = { ...DEFAULTS, ...targets };
  const checks: SlaCheck[] = [];

  // Success rate
  const okCount = entries.filter((e) => e.status === 'ok').length;
  const successRate = entries.length > 0 ? (okCount / entries.length) * 100 : 0;
  checks.push({
    metric: 'Success Rate',
    passed: successRate >= t.minSuccessRate,
    actual: Math.round(successRate * 10) / 10,
    target: t.minSuccessRate,
    margin: Math.round((successRate - t.minSuccessRate) * 10) / 10,
  });

  // Average duration
  const avgDuration = entries.length > 0
    ? entries.reduce((sum, e) => sum + e.durationSeconds, 0) / entries.length
    : 0;
  checks.push({
    metric: 'Avg Duration',
    passed: avgDuration <= t.maxAvgDuration,
    actual: Math.round(avgDuration * 10) / 10,
    target: t.maxAvgDuration,
    margin: Math.round((t.maxAvgDuration - avgDuration) * 10) / 10,
  });

  // Bugs per run
  const avgBugs = entries.length > 0
    ? entries.reduce((sum, e) => sum + (e.bugsFound ?? 0), 0) / entries.length
    : 0;
  checks.push({
    metric: 'Bugs/Run',
    passed: avgBugs <= t.maxBugsPerRun,
    actual: Math.round(avgBugs * 100) / 100,
    target: t.maxBugsPerRun,
    margin: Math.round((t.maxBugsPerRun - avgBugs) * 100) / 100,
  });

  // Recording count
  checks.push({
    metric: 'Recording Count',
    passed: entries.length >= t.minRecordings,
    actual: entries.length,
    target: t.minRecordings,
    margin: entries.length - t.minRecordings,
  });

  const passedCount = checks.filter((c) => c.passed).length;

  return {
    checks,
    compliant: passedCount === checks.length,
    passedCount,
    totalChecks: checks.length,
    entriesAnalyzed: entries.length,
  };
}

/**
 * Format SLA compliance report.
 */
export function formatSla(result: SlaResult): string {
  const lines: string[] = [];
  const statusIcon = result.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT';
  lines.push(`SLA Compliance: ${statusIcon}`);
  lines.push('═'.repeat(60));
  lines.push('');

  for (const c of result.checks) {
    const icon = c.passed ? '✓' : '✗';
    const marginStr = c.margin >= 0 ? `+${c.margin}` : `${c.margin}`;
    lines.push(`  ${icon} ${c.metric.padEnd(20)} ${c.actual.toString().padStart(8)} / ${c.target.toString().padStart(8)}  (${marginStr})`);
  }

  lines.push('');
  lines.push(`  Result: ${result.passedCount}/${result.totalChecks} checks passed`);
  lines.push(`  Entries: ${result.entriesAnalyzed} recordings analyzed`);
  return lines.join('\n');
}
