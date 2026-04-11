/**
 * Recording streak tracker — track consecutive days with recordings,
 * identify current and longest streaks, and detect breaks.
 */

import type { HistoryEntry } from './history.js';

/** A streak of consecutive recording days. */
export interface Streak {
  /** Start date (ISO date string, e.g. "2026-04-01"). */
  readonly startDate: string;
  /** End date. */
  readonly endDate: string;
  /** Number of consecutive days. */
  readonly days: number;
  /** Total recordings in this streak. */
  readonly recordings: number;
}

/** Streak analysis result. */
export interface StreakResult {
  /** Current streak (most recent, null if no recordings). */
  readonly currentStreak: Streak | null;
  /** Whether the current streak is still active (includes today or yesterday). */
  readonly isActive: boolean;
  /** Longest streak ever recorded. */
  readonly longestStreak: Streak | null;
  /** All streaks found, ordered chronologically. */
  readonly streaks: readonly Streak[];
  /** Total active days (days with at least one recording). */
  readonly totalActiveDays: number;
  /** Total span in days (first to last recording). */
  readonly totalSpan: number;
  /** Active day percentage. */
  readonly activeDayPct: number;
  /** Average recordings per active day. */
  readonly avgRecordingsPerDay: number;
}

/**
 * Analyze recording streaks from history.
 */
export function analyzeStreaks(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
): StreakResult {
  if (entries.length === 0) {
    return {
      currentStreak: null,
      isActive: false,
      longestStreak: null,
      streaks: [],
      totalActiveDays: 0,
      totalSpan: 0,
      activeDayPct: 0,
      avgRecordingsPerDay: 0,
    };
  }

  // Collect unique days and their counts
  const dayMap = new Map<string, number>();
  for (const e of entries) {
    const day = new Date(e.timestamp).toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  const sortedDays = [...dayMap.keys()].sort();
  const totalActiveDays = sortedDays.length;

  // Compute span
  const first = new Date(sortedDays[0]);
  const last = new Date(sortedDays[sortedDays.length - 1]);
  const totalSpan = Math.max(1, Math.ceil(
    (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24),
  ) + 1);

  // Build streaks
  const streaks: Streak[] = [];
  let streakStart = sortedDays[0];
  let streakRecordings = dayMap.get(sortedDays[0]) ?? 0;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 1) {
      // Consecutive
      streakRecordings += dayMap.get(sortedDays[i]) ?? 0;
    } else {
      // Break — save current streak
      const days = Math.round(
        (new Date(sortedDays[i - 1]).getTime() - new Date(streakStart).getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;
      streaks.push({
        startDate: streakStart,
        endDate: sortedDays[i - 1],
        days,
        recordings: streakRecordings,
      });
      streakStart = sortedDays[i];
      streakRecordings = dayMap.get(sortedDays[i]) ?? 0;
    }
  }

  // Push final streak
  const finalDays = Math.round(
    (new Date(sortedDays[sortedDays.length - 1]).getTime() - new Date(streakStart).getTime()) /
      (1000 * 60 * 60 * 24),
  ) + 1;
  streaks.push({
    startDate: streakStart,
    endDate: sortedDays[sortedDays.length - 1],
    days: finalDays,
    recordings: streakRecordings,
  });

  // Current streak = last streak
  const currentStreak = streaks[streaks.length - 1];

  // Is active? Check if today or yesterday is in the current streak
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const isActive = currentStreak.endDate === todayStr || currentStreak.endDate === yesterdayStr;

  // Longest streak
  const longestStreak = streaks.reduce(
    (best, s) => (s.days > best.days ? s : best),
    streaks[0],
  );

  const activeDayPct = Math.round((totalActiveDays / totalSpan) * 10000) / 100;
  const avgRecordingsPerDay = Math.round((entries.length / totalActiveDays) * 100) / 100;

  return {
    currentStreak,
    isActive,
    longestStreak,
    streaks,
    totalActiveDays,
    totalSpan,
    activeDayPct,
    avgRecordingsPerDay,
  };
}

/**
 * Format streak report.
 */
export function formatStreaks(result: StreakResult): string {
  const lines: string[] = [];
  lines.push('Recording Streaks');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalActiveDays === 0) {
    lines.push('  No recordings found.');
    return lines.join('\n');
  }

  const activeIcon = result.isActive ? '🔥' : '💤';
  lines.push(`  Current streak:   ${activeIcon} ${result.currentStreak?.days ?? 0} day(s) ${result.isActive ? '(active)' : '(inactive)'}`);
  lines.push(`  Longest streak:   🏆 ${result.longestStreak?.days ?? 0} day(s) (${result.longestStreak?.startDate ?? ''} → ${result.longestStreak?.endDate ?? ''})`);
  lines.push('');
  lines.push(`  Active days:      ${result.totalActiveDays} / ${result.totalSpan} (${result.activeDayPct}%)`);
  lines.push(`  Avg per day:      ${result.avgRecordingsPerDay} recordings`);
  lines.push(`  Total streaks:    ${result.streaks.length}`);

  if (result.streaks.length > 0) {
    lines.push('');
    lines.push('  Streak history:');
    for (const s of result.streaks) {
      const bar = '█'.repeat(Math.min(30, s.days));
      lines.push(`    ${s.startDate} → ${s.endDate}  ${s.days.toString().padStart(3)}d  ${s.recordings.toString().padStart(4)} rec  ${bar}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
