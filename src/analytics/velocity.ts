/**
 * Recording velocity tracker — compute recordings/day over rolling windows,
 * acceleration, and throughput projections.
 */

import type { HistoryEntry } from './history.js';

/** Velocity window (rolling period). */
export interface VelocityWindow {
  /** Window label (e.g., "7d", "30d"). */
  readonly label: string;
  /** Recordings in this window. */
  readonly count: number;
  /** Success count. */
  readonly successCount: number;
  /** Recordings per day in this window. */
  readonly perDay: number;
  /** Average duration in this window. */
  readonly avgDuration: number;
}

/** Velocity analysis result. */
export interface VelocityResult {
  /** Rolling window metrics. */
  readonly windows: readonly VelocityWindow[];
  /** All-time recordings per day. */
  readonly allTimePerDay: number;
  /** Acceleration: comparing recent vs older velocity. */
  readonly acceleration: 'speeding-up' | 'steady' | 'slowing-down';
  /** Projected recordings in the next 7 days (based on recent velocity). */
  readonly projected7d: number;
  /** Projected recordings in the next 30 days. */
  readonly projected30d: number;
  /** Total recordings. */
  readonly totalRecordings: number;
  /** Total span in days. */
  readonly totalDays: number;
  /** Peak daily output (highest single day). */
  readonly peakDailyOutput: number;
  /** Peak day date. */
  readonly peakDay: string;
}

/**
 * Analyze recording velocity.
 */
export function analyzeVelocity(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
): VelocityResult {
  if (entries.length === 0) {
    return {
      windows: [],
      allTimePerDay: 0,
      acceleration: 'steady',
      projected7d: 0,
      projected30d: 0,
      totalRecordings: 0,
      totalDays: 0,
      peakDailyOutput: 0,
      peakDay: '',
    };
  }

  const timestamps = entries.map((e) => new Date(e.timestamp).getTime());
  const earliest = Math.min(...timestamps);
  const totalDays = Math.max(1, Math.ceil(
    (now.getTime() - earliest) / (1000 * 60 * 60 * 24),
  ));

  const allTimePerDay = round2(entries.length / totalDays);

  // Rolling windows
  const windowDefs = [
    { label: '1d', days: 1 },
    { label: '7d', days: 7 },
    { label: '14d', days: 14 },
    { label: '30d', days: 30 },
  ];

  const windows: VelocityWindow[] = [];
  for (const def of windowDefs) {
    const cutoff = now.getTime() - def.days * 24 * 60 * 60 * 1000;
    const windowEntries = entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
    const successCount = windowEntries.filter((e) => e.status === 'ok').length;
    const avgDuration = windowEntries.length > 0
      ? round2(windowEntries.reduce((s, e) => s + e.durationSeconds, 0) / windowEntries.length)
      : 0;
    const perDay = round2(windowEntries.length / def.days);

    windows.push({
      label: def.label,
      count: windowEntries.length,
      successCount,
      perDay,
      avgDuration,
    });
  }

  // Acceleration: compare 7d rate vs 30d rate
  const rate7d = windows.find((w) => w.label === '7d')?.perDay ?? 0;
  const rate30d = windows.find((w) => w.label === '30d')?.perDay ?? 0;
  const acceleration = rate30d > 0
    ? ((rate7d - rate30d) / rate30d > 0.2 ? 'speeding-up'
      : (rate7d - rate30d) / rate30d < -0.2 ? 'slowing-down'
      : 'steady')
    : 'steady';

  // Projections based on 7d rate
  const projected7d = Math.round(rate7d * 7);
  const projected30d = Math.round(rate7d * 30);

  // Peak day
  const dayMap = new Map<string, number>();
  for (const e of entries) {
    const day = new Date(e.timestamp).toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  let peakDailyOutput = 0;
  let peakDay = '';
  for (const [day, count] of dayMap) {
    if (count > peakDailyOutput) {
      peakDailyOutput = count;
      peakDay = day;
    }
  }

  return {
    windows,
    allTimePerDay,
    acceleration,
    projected7d,
    projected30d,
    totalRecordings: entries.length,
    totalDays,
    peakDailyOutput,
    peakDay,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Format velocity report.
 */
export function formatVelocity(result: VelocityResult): string {
  const lines: string[] = [];
  const accelIcons = { 'speeding-up': '🚀', steady: '➡️', 'slowing-down': '🐢' };

  lines.push('Recording Velocity');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Total recordings: ${result.totalRecordings}`);
  lines.push(`  Period:           ${result.totalDays} days`);
  lines.push(`  All-time rate:    ${result.allTimePerDay} recordings/day`);
  lines.push(`  Acceleration:     ${accelIcons[result.acceleration]} ${result.acceleration}`);
  lines.push(`  Peak day:         ${result.peakDay} (${result.peakDailyOutput} recordings)`);
  lines.push('');

  lines.push('  Rolling windows:');
  for (const w of result.windows) {
    lines.push(`    ${w.label.padEnd(5)} ${w.count.toString().padStart(5)} recordings  ${w.perDay.toString().padStart(6)}/day  avg ${w.avgDuration}s`);
  }

  lines.push('');
  lines.push('  Projections (based on 7d rate):');
  lines.push(`    Next 7 days:    ~${result.projected7d} recordings`);
  lines.push(`    Next 30 days:   ~${result.projected30d} recordings`);

  lines.push('');
  return lines.join('\n');
}
