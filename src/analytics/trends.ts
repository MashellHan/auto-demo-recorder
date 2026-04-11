/**
 * Recording trend analysis — track quality trends over time
 * using sliding windows.
 *
 * Shows how success rate, bug count, and duration change
 * across recording windows to identify improvement or regression.
 */

import type { HistoryEntry } from './history.js';

/** A single trend window. */
export interface TrendWindow {
  /** Window label (e.g., "Week 1", "2026-04-07"). */
  readonly label: string;
  /** Entries in this window. */
  readonly count: number;
  /** Success rate (0-100). */
  readonly successRate: number;
  /** Average duration. */
  readonly avgDuration: number;
  /** Total bugs. */
  readonly totalBugs: number;
}

/** Trend direction. */
export type TrendDirection = 'improving' | 'stable' | 'declining';

/** Trend analysis result. */
export interface TrendResult {
  /** Time windows. */
  readonly windows: readonly TrendWindow[];
  /** Overall trend direction for success rate. */
  readonly successTrend: TrendDirection;
  /** Overall trend direction for bug count. */
  readonly bugTrend: TrendDirection;
  /** Overall trend direction for duration. */
  readonly durationTrend: TrendDirection;
  /** Total entries analyzed. */
  readonly totalEntries: number;
}

/**
 * Analyze recording trends using daily windows.
 */
export function analyzeTrends(entries: readonly HistoryEntry[]): TrendResult {
  if (entries.length === 0) {
    return {
      windows: [],
      successTrend: 'stable',
      bugTrend: 'stable',
      durationTrend: 'stable',
      totalEntries: 0,
    };
  }

  // Group by date
  const byDate = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
    const list = byDate.get(date) ?? [];
    list.push(entry);
    byDate.set(date, list);
  }

  // Sort dates
  const sortedDates = Array.from(byDate.keys()).sort();

  const windows: TrendWindow[] = sortedDates.map((date) => {
    const dayEntries = byDate.get(date)!;
    const okCount = dayEntries.filter((e) => e.status === 'ok').length;
    const totalBugs = dayEntries.reduce((sum, e) => sum + e.bugsFound, 0);
    const totalDur = dayEntries.reduce((sum, e) => sum + e.durationSeconds, 0);

    return {
      label: date,
      count: dayEntries.length,
      successRate: Math.round((okCount / dayEntries.length) * 100),
      avgDuration: dayEntries.length > 0 ? totalDur / dayEntries.length : 0,
      totalBugs,
    };
  });

  return {
    windows,
    successTrend: detectTrend(windows.map((w) => w.successRate), true),
    bugTrend: detectTrend(windows.map((w) => w.totalBugs), false),
    durationTrend: detectTrend(windows.map((w) => w.avgDuration), false),
    totalEntries: entries.length,
  };
}

/**
 * Detect trend direction from a series of values.
 * @param increasing — whether higher values are better
 */
function detectTrend(values: readonly number[], increasing: boolean): TrendDirection {
  if (values.length < 2) return 'stable';

  // Simple: compare first half average to second half average
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = secondAvg - firstAvg;
  const threshold = Math.abs(firstAvg) * 0.1; // 10% change threshold

  if (Math.abs(change) < threshold) return 'stable';

  if (increasing) {
    return change > 0 ? 'improving' : 'declining';
  } else {
    return change < 0 ? 'improving' : 'declining';
  }
}

/**
 * Format trend analysis as a report.
 */
export function formatTrendReport(result: TrendResult): string {
  const lines: string[] = [];
  lines.push('Recording Trends');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.windows.length === 0) {
    lines.push('  No recording data to analyze.');
    return lines.join('\n');
  }

  const icons: Record<TrendDirection, string> = {
    improving: '↑',
    stable: '→',
    declining: '↓',
  };

  // Trend summary
  lines.push(`  Success Rate: ${icons[result.successTrend]} ${result.successTrend}`);
  lines.push(`  Bug Count:    ${icons[result.bugTrend]} ${result.bugTrend}`);
  lines.push(`  Duration:     ${icons[result.durationTrend]} ${result.durationTrend}`);
  lines.push('');

  // Window table
  lines.push('  Date          Runs  Success  Bugs  Avg Duration');
  lines.push('  ' + '─'.repeat(52));

  for (const w of result.windows) {
    const runs = String(w.count).padStart(4);
    const success = `${w.successRate}%`.padStart(7);
    const bugs = String(w.totalBugs).padStart(5);
    const dur = `${w.avgDuration.toFixed(1)}s`.padStart(12);

    lines.push(`  ${w.label}  ${runs}  ${success}  ${bugs}  ${dur}`);
  }

  lines.push('');
  lines.push(`  Total: ${result.totalEntries} recordings across ${result.windows.length} days`);
  return lines.join('\n');
}
