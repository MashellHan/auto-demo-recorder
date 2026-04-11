/**
 * Recording quality trend analyzer — tracks quality dimensions (success rate,
 * duration, bug rate) over configurable time windows and identifies
 * improving/degrading/stable trends per dimension.
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** Direction a quality dimension is trending. */
export type QualityDirection = 'improving' | 'degrading' | 'stable';

/** A single quality snapshot for one time window. */
export interface QualitySnapshot {
  /** Window label (e.g., "week 1", "week 2"). */
  readonly label: string;
  /** Window start date (ISO). */
  readonly startDate: string;
  /** Window end date (ISO). */
  readonly endDate: string;
  /** Number of recordings in window. */
  readonly count: number;
  /** Success rate (0-100). */
  readonly successRate: number;
  /** Average duration in seconds. */
  readonly avgDuration: number;
  /** Bugs per recording. */
  readonly bugRate: number;
}

/** Trend for a single quality dimension. */
export interface DimensionTrend {
  /** Dimension name. */
  readonly name: string;
  /** Current value. */
  readonly current: number;
  /** Previous value (prior window). */
  readonly previous: number;
  /** Change from previous. */
  readonly change: number;
  /** Change as percentage. */
  readonly changePct: number;
  /** Trend direction. */
  readonly direction: QualityDirection;
}

/** Quality trend analysis result. */
export interface QualityTrendResult {
  /** Time-series snapshots (oldest first). */
  readonly snapshots: readonly QualitySnapshot[];
  /** Per-dimension trend analysis (comparing most recent vs prior). */
  readonly dimensions: readonly DimensionTrend[];
  /** Overall quality direction (based on majority of dimensions). */
  readonly overall: QualityDirection;
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Number of windows. */
  readonly windowCount: number;
  /** Window size in days. */
  readonly windowDays: number;
}

/**
 * Analyze quality trends over time windows.
 *
 * @param entries Recording history entries.
 * @param windowDays Size of each window in days (default: 7).
 * @param maxWindows Maximum number of windows to compute (default: 8).
 * @param now Reference date for computing windows.
 */
export function analyzeQualityTrends(
  entries: readonly HistoryEntry[],
  windowDays = 7,
  maxWindows = 8,
  now: Date = new Date(),
): QualityTrendResult {
  if (entries.length === 0) {
    return {
      snapshots: [],
      dimensions: [],
      overall: 'stable',
      totalRecordings: 0,
      windowCount: 0,
      windowDays,
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const windowMs = windowDays * msPerDay;

  // Build windows from most recent backwards
  const snapshots: QualitySnapshot[] = [];
  for (let i = 0; i < maxWindows; i++) {
    const windowEnd = new Date(now.getTime() - i * windowMs);
    const windowStart = new Date(windowEnd.getTime() - windowMs);
    const windowEntries = entries.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t > windowStart.getTime() && t <= windowEnd.getTime();
    });

    if (windowEntries.length === 0) continue;

    const okCount = windowEntries.filter((e) => e.status === 'ok').length;
    const successRate = round2((okCount / windowEntries.length) * 100);
    const avgDuration = round2(
      windowEntries.reduce((s, e) => s + e.durationSeconds, 0) / windowEntries.length,
    );
    const totalBugs = windowEntries.reduce((s, e) => s + (e.bugsFound ?? 0), 0);
    const bugRate = round2(totalBugs / windowEntries.length);

    snapshots.push({
      label: `week ${i + 1}`,
      startDate: windowStart.toISOString().slice(0, 10),
      endDate: windowEnd.toISOString().slice(0, 10),
      count: windowEntries.length,
      successRate,
      avgDuration,
      bugRate,
    });
  }

  // Reverse so oldest is first
  snapshots.reverse();

  // Compute dimension trends (most recent vs prior)
  const dimensions: DimensionTrend[] = [];
  if (snapshots.length >= 2) {
    const current = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];

    // Success rate: higher is better
    dimensions.push(computeDimension('successRate', current.successRate, previous.successRate, true));
    // Duration: lower is better
    dimensions.push(computeDimension('avgDuration', current.avgDuration, previous.avgDuration, false));
    // Bug rate: lower is better
    dimensions.push(computeDimension('bugRate', current.bugRate, previous.bugRate, false));
  }

  // Overall direction: majority vote
  const improvingCount = dimensions.filter((d) => d.direction === 'improving').length;
  const degradingCount = dimensions.filter((d) => d.direction === 'degrading').length;
  const overall: QualityDirection =
    improvingCount > degradingCount ? 'improving'
    : degradingCount > improvingCount ? 'degrading'
    : 'stable';

  return {
    snapshots,
    dimensions,
    overall,
    totalRecordings: entries.length,
    windowCount: snapshots.length,
    windowDays,
  };
}

function computeDimension(
  name: string,
  current: number,
  previous: number,
  higherIsBetter: boolean,
): DimensionTrend {
  const change = round2(current - previous);
  const changePct = previous !== 0 ? round2((change / previous) * 100) : 0;
  const threshold = 5; // 5% change threshold for trend detection
  const direction: QualityDirection =
    Math.abs(changePct) < threshold ? 'stable'
    : (higherIsBetter ? change > 0 : change < 0) ? 'improving'
    : 'degrading';

  return { name, current, previous, change, changePct, direction };
}

/**
 * Format quality trend report.
 */
export function formatQualityTrends(result: QualityTrendResult): string {
  const lines: string[] = [];
  const dirIcons = { improving: '📈', degrading: '📉', stable: '➡️' };

  lines.push('Recording Quality Trends');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Total recordings:  ${result.totalRecordings}`);
  lines.push(`  Window size:       ${result.windowDays} days`);
  lines.push(`  Windows analyzed:  ${result.windowCount}`);
  lines.push(`  Overall trend:     ${dirIcons[result.overall]} ${result.overall}`);
  lines.push('');

  if (result.dimensions.length > 0) {
    lines.push('  Dimension trends (most recent vs prior window):');
    for (const d of result.dimensions) {
      const sign = d.change >= 0 ? '+' : '';
      lines.push(
        `    ${d.name.padEnd(15)} ${d.current.toString().padStart(8)} (${sign}${d.changePct}%)  ${dirIcons[d.direction]} ${d.direction}`,
      );
    }
    lines.push('');
  }

  lines.push('  Time series:');
  lines.push(`    ${'Window'.padEnd(10)} ${'Count'.padStart(6)} ${'Success'.padStart(8)} ${'Duration'.padStart(9)} ${'Bugs/rec'.padStart(9)}`);
  lines.push(`    ${'─'.repeat(10)} ${'─'.repeat(6)} ${'─'.repeat(8)} ${'─'.repeat(9)} ${'─'.repeat(9)}`);
  for (const s of result.snapshots) {
    lines.push(
      `    ${s.label.padEnd(10)} ${s.count.toString().padStart(6)} ${(s.successRate + '%').padStart(8)} ${(s.avgDuration + 's').padStart(9)} ${s.bugRate.toString().padStart(9)}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}
