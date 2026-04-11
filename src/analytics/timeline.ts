/**
 * Recording timeline generator — creates a chronological view of
 * recording sessions with duration visualization.
 *
 * Useful for analyzing recording patterns, identifying long-running
 * scenarios, and spotting recording gaps.
 */

import type { HistoryEntry } from './history.js';

/** Timeline entry with computed display data. */
export interface TimelineEntry {
  /** Session ID. */
  readonly sessionId: string;
  /** Scenario name. */
  readonly scenario: string;
  /** Recording status. */
  readonly status: string;
  /** Duration in seconds. */
  readonly durationSeconds: number;
  /** Backend used. */
  readonly backend: string;
  /** ISO timestamp. */
  readonly timestamp: string;
  /** Duration bar for visual display. */
  readonly bar: string;
}

/** Complete timeline result. */
export interface TimelineResult {
  /** All entries sorted chronologically. */
  readonly entries: readonly TimelineEntry[];
  /** Total duration across all recordings. */
  readonly totalDurationSeconds: number;
  /** Average duration per recording. */
  readonly avgDurationSeconds: number;
  /** Longest recording. */
  readonly longest: TimelineEntry | null;
  /** Shortest recording. */
  readonly shortest: TimelineEntry | null;
}

/**
 * Generate a timeline from recording history entries.
 */
export function generateTimeline(entries: readonly HistoryEntry[]): TimelineResult {
  if (entries.length === 0) {
    return {
      entries: [],
      totalDurationSeconds: 0,
      avgDurationSeconds: 0,
      longest: null,
      shortest: null,
    };
  }

  // Sort by timestamp chronologically
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Find max duration for bar scaling
  const maxDuration = Math.max(...sorted.map((e) => e.durationSeconds), 1);
  const barWidth = 30;

  const timelineEntries: TimelineEntry[] = sorted.map((e) => ({
    sessionId: e.sessionId,
    scenario: e.scenario,
    status: e.status,
    durationSeconds: e.durationSeconds,
    backend: e.backend,
    timestamp: e.timestamp,
    bar: generateBar(e.durationSeconds, maxDuration, barWidth),
  }));

  const totalDurationSeconds = sorted.reduce((sum, e) => sum + e.durationSeconds, 0);
  const avgDurationSeconds = Math.round(totalDurationSeconds / sorted.length);

  // Find longest and shortest
  let longest = timelineEntries[0];
  let shortest = timelineEntries[0];
  for (const entry of timelineEntries) {
    if (entry.durationSeconds > longest.durationSeconds) longest = entry;
    if (entry.durationSeconds < shortest.durationSeconds) shortest = entry;
  }

  return {
    entries: timelineEntries,
    totalDurationSeconds,
    avgDurationSeconds,
    longest,
    shortest,
  };
}

function generateBar(value: number, max: number, width: number): string {
  const filled = Math.max(1, Math.round((value / max) * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Format the timeline as a human-readable report.
 */
export function formatTimeline(result: TimelineResult): string {
  if (result.entries.length === 0) {
    return 'No recording history found.';
  }

  const lines: string[] = [];
  lines.push('Recording Timeline');
  lines.push('═'.repeat(80));
  lines.push('');

  for (const entry of result.entries) {
    const time = entry.timestamp.substring(11, 19); // HH:MM:SS
    const status = entry.status === 'success' ? '✓' : entry.status === 'failed' ? '✗' : '○';
    const duration = `${entry.durationSeconds}s`;
    lines.push(
      `  ${time} ${status} ${entry.scenario.padEnd(20)} ${entry.bar} ${duration.padStart(5)} [${entry.backend}]`,
    );
  }

  lines.push('');
  lines.push('═'.repeat(80));
  lines.push(`Total: ${result.entries.length} recordings, ${result.totalDurationSeconds}s total`);
  lines.push(`Average: ${result.avgDurationSeconds}s per recording`);
  if (result.longest) {
    lines.push(`Longest: ${result.longest.scenario} (${result.longest.durationSeconds}s)`);
  }
  if (result.shortest) {
    lines.push(`Shortest: ${result.shortest.scenario} (${result.shortest.durationSeconds}s)`);
  }

  return lines.join('\n');
}
