/**
 * Recording efficiency metrics — compute time efficiency (recording time
 * vs calendar time), throughput, utilization rate, and idle time analysis.
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** Efficiency metrics result. */
export interface EfficiencyResult {
  /** Total recordings. */
  readonly totalRecordings: number;
  /** Total recording time in seconds. */
  readonly totalRecordingTime: number;
  /** Total calendar time in hours (first to last recording). */
  readonly calendarTimeHours: number;
  /** Utilization rate: recording time / calendar time (0-100%). */
  readonly utilizationPct: number;
  /** Average throughput: recordings per hour. */
  readonly throughputPerHour: number;
  /** Average recording duration in seconds. */
  readonly avgDuration: number;
  /** Median recording duration in seconds. */
  readonly medianDuration: number;
  /** Success throughput: successful recordings per hour. */
  readonly successThroughput: number;
  /** Success rate as percentage. */
  readonly successRate: number;
  /** Idle time analysis. */
  readonly idle: IdleAnalysis;
  /** Per-hour throughput breakdown. */
  readonly hourlyThroughput: readonly HourlyBucket[];
}

/** Idle time analysis. */
export interface IdleAnalysis {
  /** Longest idle period in hours. */
  readonly longestIdleHours: number;
  /** Average idle between recordings in minutes. */
  readonly avgIdleMinutes: number;
  /** Number of idle gaps > 1 hour. */
  readonly idleGaps: number;
}

/** Per-hour throughput bucket. */
export interface HourlyBucket {
  /** Hour of day (0-23). */
  readonly hour: number;
  /** Number of recordings in this hour. */
  readonly count: number;
}

/**
 * Compute recording efficiency metrics.
 */
export function computeEfficiency(entries: readonly HistoryEntry[]): EfficiencyResult {
  if (entries.length === 0) {
    return {
      totalRecordings: 0,
      totalRecordingTime: 0,
      calendarTimeHours: 0,
      utilizationPct: 0,
      throughputPerHour: 0,
      avgDuration: 0,
      medianDuration: 0,
      successThroughput: 0,
      successRate: 0,
      idle: { longestIdleHours: 0, avgIdleMinutes: 0, idleGaps: 0 },
      hourlyThroughput: [],
    };
  }

  const totalRecordingTime = entries.reduce((s, e) => s + e.durationSeconds, 0);
  const avgDuration = round2(totalRecordingTime / entries.length);

  // Median duration
  const durations = [...entries.map((e) => e.durationSeconds)].sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const medianDuration = durations.length % 2 === 0
    ? round2((durations[mid - 1] + durations[mid]) / 2)
    : durations[mid];

  // Calendar time
  const timestamps = entries.map((e) => new Date(e.timestamp).getTime());
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  const calendarTimeMs = latest - earliest;
  const calendarTimeHours = round2(Math.max(
    totalRecordingTime / 3600,
    calendarTimeMs / (1000 * 60 * 60),
  ));

  // Utilization
  const recordingTimeHours = totalRecordingTime / 3600;
  const utilizationPct = calendarTimeHours > 0
    ? round2((recordingTimeHours / calendarTimeHours) * 100)
    : 100;

  // Throughput
  const throughputPerHour = calendarTimeHours > 0
    ? round2(entries.length / calendarTimeHours)
    : entries.length;

  // Success metrics
  const okCount = entries.filter((e) => e.status === 'ok').length;
  const successRate = round2((okCount / entries.length) * 100);
  const successThroughput = calendarTimeHours > 0
    ? round2(okCount / calendarTimeHours)
    : okCount;

  // Idle analysis
  const sorted = [...timestamps].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }

  const longestIdleMs = gaps.length > 0 ? Math.max(...gaps) : 0;
  const longestIdleHours = round2(longestIdleMs / (1000 * 60 * 60));
  const avgIdleMs = gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
  const avgIdleMinutes = round2(avgIdleMs / (1000 * 60));
  const idleGaps = gaps.filter((g) => g > 60 * 60 * 1000).length;

  // Hourly throughput
  const hourCounts = new Map<number, number>();
  for (const e of entries) {
    const hour = new Date(e.timestamp).getUTCHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  const hourlyThroughput: HourlyBucket[] = [];
  for (let h = 0; h < 24; h++) {
    const count = hourCounts.get(h) ?? 0;
    if (count > 0) {
      hourlyThroughput.push({ hour: h, count });
    }
  }

  return {
    totalRecordings: entries.length,
    totalRecordingTime,
    calendarTimeHours,
    utilizationPct,
    throughputPerHour,
    avgDuration,
    medianDuration,
    successThroughput,
    successRate,
    idle: { longestIdleHours, avgIdleMinutes, idleGaps },
    hourlyThroughput,
  };
}

/**
 * Format efficiency report.
 */
export function formatEfficiency(result: EfficiencyResult): string {
  const lines: string[] = [];
  lines.push('Recording Efficiency Metrics');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Total recordings:     ${result.totalRecordings}`);
  lines.push(`  Total recording time: ${formatSeconds(result.totalRecordingTime)}`);
  lines.push(`  Calendar span:        ${result.calendarTimeHours}h`);
  lines.push(`  Utilization:          ${result.utilizationPct}%`);
  lines.push('');
  lines.push(`  Throughput:           ${result.throughputPerHour} recordings/hour`);
  lines.push(`  Success throughput:   ${result.successThroughput} ok/hour`);
  lines.push(`  Success rate:         ${result.successRate}%`);
  lines.push('');
  lines.push(`  Avg duration:         ${result.avgDuration}s`);
  lines.push(`  Median duration:      ${result.medianDuration}s`);
  lines.push('');
  lines.push(`  Longest idle:         ${result.idle.longestIdleHours}h`);
  lines.push(`  Avg idle:             ${result.idle.avgIdleMinutes}min`);
  lines.push(`  Idle gaps (>1h):      ${result.idle.idleGaps}`);

  if (result.hourlyThroughput.length > 0) {
    lines.push('');
    lines.push('  Recordings by hour:');
    const maxCount = Math.max(...result.hourlyThroughput.map((b) => b.count));
    for (const b of result.hourlyThroughput) {
      const barLen = maxCount > 0 ? Math.round((b.count / maxCount) * 25) : 0;
      const bar = '█'.repeat(barLen);
      lines.push(`    ${b.hour.toString().padStart(2, '0')}:00  ${b.count.toString().padStart(4)} ${bar}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${Math.round(seconds / 360) / 10}h`;
}
