/**
 * Recording session grouping — group history entries by configurable
 * criteria for batch analysis.
 *
 * Supports grouping by: day, week, scenario, backend, status.
 * Computes aggregate stats per group.
 */

import type { HistoryEntry } from './history.js';

/** Grouping criteria. */
export type GroupBy = 'day' | 'week' | 'scenario' | 'backend' | 'status';

/** A group of recording entries with aggregate stats. */
export interface RecordingGroup {
  /** Group key (e.g., "2026-04-11", "basic", "vhs"). */
  readonly key: string;
  /** Number of entries in this group. */
  readonly count: number;
  /** Success rate (0-1). */
  readonly successRate: number;
  /** Average duration in seconds. */
  readonly avgDuration: number;
  /** Total bugs found. */
  readonly totalBugs: number;
  /** Entries in this group. */
  readonly entries: readonly HistoryEntry[];
}

/** Session grouping result. */
export interface GroupingResult {
  /** Grouped recordings. */
  readonly groups: readonly RecordingGroup[];
  /** Grouping criterion used. */
  readonly groupBy: GroupBy;
  /** Total entries analyzed. */
  readonly totalAnalyzed: number;
}

/**
 * Extract the group key from an entry.
 */
function getGroupKey(entry: HistoryEntry, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'day': {
      return entry.timestamp.slice(0, 10); // YYYY-MM-DD
    }
    case 'week': {
      const date = new Date(entry.timestamp);
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
      const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
      return `${date.getFullYear()}-W${week.toString().padStart(2, '0')}`;
    }
    case 'scenario':
      return entry.scenario;
    case 'backend':
      return entry.backend;
    case 'status':
      return entry.status;
  }
}

/**
 * Group recording entries by the specified criterion.
 */
export function groupRecordings(
  entries: readonly HistoryEntry[],
  groupBy: GroupBy = 'day',
): GroupingResult {
  const map = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const key = getGroupKey(entry, groupBy);
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }

  const groups: RecordingGroup[] = [];

  for (const [key, groupEntries] of map) {
    const okCount = groupEntries.filter((e) => e.status === 'ok').length;
    const totalDuration = groupEntries.reduce((sum, e) => sum + e.durationSeconds, 0);
    const totalBugs = groupEntries.reduce((sum, e) => sum + e.bugsFound, 0);

    groups.push({
      key,
      count: groupEntries.length,
      successRate: groupEntries.length > 0 ? okCount / groupEntries.length : 0,
      avgDuration: groupEntries.length > 0 ? totalDuration / groupEntries.length : 0,
      totalBugs,
      entries: groupEntries,
    });
  }

  // Sort by key
  groups.sort((a, b) => a.key.localeCompare(b.key));

  return { groups, groupBy, totalAnalyzed: entries.length };
}

/**
 * Format session grouping results.
 */
export function formatGrouping(result: GroupingResult): string {
  const lines: string[] = [];
  lines.push(`Recording Groups (by ${result.groupBy})`);
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.groups.length === 0) {
    lines.push('  No recordings to group.');
    return lines.join('\n');
  }

  const header = `${'Group'.padEnd(24)} ${'Count'.padStart(6)} ${'Success'.padStart(8)} ${'Avg Dur'.padStart(8)} ${'Bugs'.padStart(5)}`;
  lines.push(`  ${header}`);
  lines.push(`  ${'─'.repeat(header.length)}`);

  for (const g of result.groups) {
    const success = `${Math.round(g.successRate * 100)}%`;
    const dur = `${g.avgDuration.toFixed(1)}s`;
    lines.push(`  ${g.key.padEnd(24)} ${g.count.toString().padStart(6)} ${success.padStart(8)} ${dur.padStart(8)} ${g.totalBugs.toString().padStart(5)}`);
  }

  lines.push('');
  lines.push(`  Total: ${result.groups.length} groups, ${result.totalAnalyzed} recordings`);
  return lines.join('\n');
}
