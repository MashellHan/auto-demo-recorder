/**
 * Recording burndown chart — tracks progress toward a recording target
 * with ideal vs actual comparison and projected completion date.
 */

import type { HistoryEntry } from './history.js';

/** A single day in the burndown chart. */
export interface BurndownDay {
  /** Date (ISO date string). */
  readonly date: string;
  /** Remaining recordings to reach target. */
  readonly remaining: number;
  /** Ideal remaining for this day (linear from target to 0). */
  readonly idealRemaining: number;
  /** Cumulative recordings completed. */
  readonly completed: number;
  /** Recordings on this specific day. */
  readonly dailyCount: number;
}

/** Complete burndown chart result. */
export interface BurndownResult {
  /** Target total recordings. */
  readonly target: number;
  /** Start date (ISO). */
  readonly startDate: string;
  /** Deadline date (ISO). */
  readonly deadline: string;
  /** Total calendar days in the sprint. */
  readonly sprintDays: number;
  /** Days elapsed so far. */
  readonly daysElapsed: number;
  /** Total recordings completed. */
  readonly totalCompleted: number;
  /** Remaining to target. */
  readonly remaining: number;
  /** Whether the target has been reached. */
  readonly targetReached: boolean;
  /** Current daily velocity (based on active days). */
  readonly dailyVelocity: number;
  /** Projected completion date (ISO) or 'never' if velocity is 0. */
  readonly projectedCompletion: string;
  /** Whether on track (projected completion <= deadline). */
  readonly onTrack: boolean;
  /** Daily burndown data points. */
  readonly days: readonly BurndownDay[];
  /** Whether there is enough data. */
  readonly hasData: boolean;
}

/**
 * Compute burndown chart data.
 *
 * @param entries - Recording history entries
 * @param target - Target number of recordings
 * @param startDate - Sprint start date
 * @param deadline - Sprint deadline
 * @param now - Current date (injectable for testing)
 */
export function computeBurndown(
  entries: readonly HistoryEntry[],
  target: number,
  startDate: Date,
  deadline: Date,
  now: Date = new Date(),
): BurndownResult {
  const msPerDay = 24 * 60 * 60 * 1000;
  const sprintDays = Math.max(1, Math.ceil((deadline.getTime() - startDate.getTime()) / msPerDay));
  const effectiveNow = now < deadline ? now : deadline;
  const daysElapsed = Math.max(0, Math.ceil((effectiveNow.getTime() - startDate.getTime()) / msPerDay));

  // Filter entries within the sprint window
  const sprintEntries = entries.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t >= startDate.getTime() && t <= now.getTime();
  });

  if (sprintEntries.length === 0) {
    const days = buildBurndownDays(startDate, effectiveNow, target, sprintDays, new Map());
    return {
      target,
      startDate: startDate.toISOString().slice(0, 10),
      deadline: deadline.toISOString().slice(0, 10),
      sprintDays,
      daysElapsed,
      totalCompleted: 0,
      remaining: target,
      targetReached: false,
      dailyVelocity: 0,
      projectedCompletion: 'never',
      onTrack: false,
      days,
      hasData: false,
    };
  }

  // Group by date
  const byDate = new Map<string, number>();
  for (const e of sprintEntries) {
    const date = e.timestamp.slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
  }

  const totalCompleted = sprintEntries.length;
  const remaining = Math.max(0, target - totalCompleted);
  const targetReached = totalCompleted >= target;

  // Compute velocity from active days
  const activeDays = byDate.size;
  const dailyVelocity = activeDays > 0 ? round2(totalCompleted / activeDays) : 0;

  // Project completion
  let projectedCompletion = 'never';
  let onTrack = false;

  if (targetReached) {
    projectedCompletion = 'reached';
    onTrack = true;
  } else if (dailyVelocity > 0) {
    const daysNeeded = Math.ceil(remaining / dailyVelocity);
    const projectedDate = new Date(now);
    projectedDate.setUTCDate(projectedDate.getUTCDate() + daysNeeded);
    projectedCompletion = projectedDate.toISOString().slice(0, 10);
    onTrack = projectedDate.getTime() <= deadline.getTime();
  }

  const days = buildBurndownDays(startDate, effectiveNow, target, sprintDays, byDate);

  return {
    target,
    startDate: startDate.toISOString().slice(0, 10),
    deadline: deadline.toISOString().slice(0, 10),
    sprintDays,
    daysElapsed,
    totalCompleted,
    remaining,
    targetReached,
    dailyVelocity,
    projectedCompletion,
    onTrack,
    days,
    hasData: true,
  };
}

/**
 * Build daily burndown data points.
 */
function buildBurndownDays(
  startDate: Date,
  endDate: Date,
  target: number,
  sprintDays: number,
  byDate: Map<string, number>,
): BurndownDay[] {
  const days: BurndownDay[] = [];
  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  let cumulative = 0;
  let dayIndex = 0;

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dailyCount = byDate.get(dateStr) ?? 0;
    cumulative += dailyCount;

    const idealRemaining = Math.max(0, round2(target - (target * dayIndex / sprintDays)));
    const remaining = Math.max(0, target - cumulative);

    days.push({
      date: dateStr,
      remaining,
      idealRemaining,
      completed: cumulative,
      dailyCount,
    });

    dayIndex++;
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Format burndown chart as a readable report.
 */
export function formatBurndown(result: BurndownResult): string {
  const lines: string[] = [];

  lines.push('Recording Burndown Chart');
  lines.push('═'.repeat(60));
  lines.push(`  Target:     ${result.target} recordings`);
  lines.push(`  Sprint:     ${result.startDate} → ${result.deadline} (${result.sprintDays} days)`);
  lines.push(`  Elapsed:    ${result.daysElapsed} day(s)`);
  lines.push(`  Completed:  ${result.totalCompleted}`);
  lines.push(`  Remaining:  ${result.remaining}`);

  const statusIcon = result.targetReached ? '🎯' : result.onTrack ? '✅' : '⚠️';
  const statusLabel = result.targetReached
    ? 'Target reached!'
    : result.onTrack
      ? 'On track'
      : 'Behind schedule';
  lines.push(`  Status:     ${statusIcon} ${statusLabel}`);

  if (result.dailyVelocity > 0) {
    lines.push(`  Velocity:   ${result.dailyVelocity}/day`);
  }
  if (result.projectedCompletion !== 'never' && result.projectedCompletion !== 'reached') {
    lines.push(`  Projected:  ${result.projectedCompletion}`);
  }
  lines.push('');

  if (!result.hasData) {
    lines.push('  No recordings in sprint window.');
    return lines.join('\n');
  }

  // Show chart
  if (result.days.length > 0) {
    lines.push('  Date         Done  Remain  Ideal   Daily');
    lines.push('  ────────── ────── ─────── ─────── ──────');
    for (const d of result.days) {
      const done = d.completed.toString().padStart(6);
      const rem = d.remaining.toString().padStart(7);
      const ideal = d.idealRemaining.toFixed(0).padStart(7);
      const daily = d.dailyCount.toString().padStart(6);
      const bar = d.remaining <= d.idealRemaining ? '✅' : '🔴';
      lines.push(`  ${d.date} ${done} ${rem} ${ideal} ${daily}  ${bar}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
