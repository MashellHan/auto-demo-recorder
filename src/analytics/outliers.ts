/**
 * Recording outlier detection — identify recordings that deviate
 * significantly from the norm in duration, bugs, or status pattern.
 *
 * Uses Z-score analysis to flag anomalous recordings.
 */

import type { HistoryEntry } from './history.js';

/** A detected outlier. */
export interface Outlier {
  /** The outlier entry. */
  readonly entry: HistoryEntry;
  /** Why it was flagged. */
  readonly reason: string;
  /** Z-score or deviation metric. */
  readonly deviation: number;
  /** Outlier type. */
  readonly type: 'duration' | 'bugs' | 'status';
}

/** Outlier detection result. */
export interface OutlierResult {
  /** Detected outliers, sorted by deviation descending. */
  readonly outliers: readonly Outlier[];
  /** Total entries analyzed. */
  readonly totalAnalyzed: number;
  /** Average duration (reference). */
  readonly avgDuration: number;
  /** Standard deviation of duration. */
  readonly stdDevDuration: number;
}

/**
 * Detect outlier recordings from history.
 *
 * Flags entries where:
 * - Duration is >2 standard deviations from the mean
 * - Bug count is >2 standard deviations from the mean
 * - Error status when >80% of recordings are ok
 */
export function detectOutliers(
  entries: readonly HistoryEntry[],
  threshold: number = 2.0,
): OutlierResult {
  if (entries.length < 3) {
    return { outliers: [], totalAnalyzed: entries.length, avgDuration: 0, stdDevDuration: 0 };
  }

  const durations = entries.map((e) => e.durationSeconds);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((sum, d) => sum + (d - avgDuration) ** 2, 0) / durations.length;
  const stdDevDuration = Math.sqrt(variance);

  const bugs = entries.map((e) => e.bugsFound);
  const avgBugs = bugs.reduce((a, b) => a + b, 0) / bugs.length;
  const bugVariance = bugs.reduce((sum, b) => sum + (b - avgBugs) ** 2, 0) / bugs.length;
  const stdDevBugs = Math.sqrt(bugVariance);

  const okRate = entries.filter((e) => e.status === 'ok').length / entries.length;

  const outliers: Outlier[] = [];

  for (const entry of entries) {
    // Duration outlier
    if (stdDevDuration > 0) {
      const zDuration = Math.abs(entry.durationSeconds - avgDuration) / stdDevDuration;
      if (zDuration > threshold) {
        const direction = entry.durationSeconds > avgDuration ? 'slower' : 'faster';
        outliers.push({
          entry,
          reason: `Duration ${entry.durationSeconds.toFixed(1)}s is ${direction} than average (${avgDuration.toFixed(1)}s ± ${stdDevDuration.toFixed(1)}s)`,
          deviation: zDuration,
          type: 'duration',
        });
      }
    }

    // Bug outlier
    if (stdDevBugs > 0) {
      const zBugs = Math.abs(entry.bugsFound - avgBugs) / stdDevBugs;
      if (zBugs > threshold && entry.bugsFound > avgBugs) {
        outliers.push({
          entry,
          reason: `${entry.bugsFound} bugs is unusually high (avg ${avgBugs.toFixed(1)} ± ${stdDevBugs.toFixed(1)})`,
          deviation: zBugs,
          type: 'bugs',
        });
      }
    }

    // Status outlier — error in mostly-ok dataset
    if (okRate > 0.8 && (entry.status === 'error' || entry.status === 'fail')) {
      outliers.push({
        entry,
        reason: `Failed recording when ${Math.round(okRate * 100)}% succeed`,
        deviation: 1 / (1 - okRate), // Higher deviation when failure is rarer
        type: 'status',
      });
    }
  }

  // Sort by deviation descending
  outliers.sort((a, b) => b.deviation - a.deviation);

  return { outliers, totalAnalyzed: entries.length, avgDuration, stdDevDuration };
}

/**
 * Format outlier detection results.
 */
export function formatOutliers(result: OutlierResult): string {
  const lines: string[] = [];
  lines.push('Outlier Detection');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalAnalyzed < 3) {
    lines.push('  Need at least 3 recordings for outlier detection.');
    return lines.join('\n');
  }

  if (result.outliers.length === 0) {
    lines.push('  ✓ No outliers detected — all recordings are within normal range.');
    lines.push(`  Analyzed: ${result.totalAnalyzed} recordings`);
    lines.push(`  Avg duration: ${result.avgDuration.toFixed(1)}s ± ${result.stdDevDuration.toFixed(1)}s`);
    return lines.join('\n');
  }

  lines.push(`  Found ${result.outliers.length} outlier(s) in ${result.totalAnalyzed} recordings:`);
  lines.push('');

  for (const o of result.outliers) {
    const icon = o.type === 'duration' ? '⏱' : o.type === 'bugs' ? '🐛' : '✗';
    const ts = o.entry.timestamp.slice(0, 19).replace('T', ' ');
    lines.push(`  ${icon} ${o.entry.scenario.padEnd(20)} ${ts}`);
    lines.push(`    ${o.reason} (z=${o.deviation.toFixed(1)})`);
  }

  lines.push('');
  lines.push(`  Reference: avg duration ${result.avgDuration.toFixed(1)}s ± ${result.stdDevDuration.toFixed(1)}s`);
  return lines.join('\n');
}
