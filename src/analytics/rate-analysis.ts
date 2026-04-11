/**
 * Recording rate analysis — analyze recording frequency over time
 * to identify daily/weekly rates, peak periods, and velocity trends.
 */

import type { HistoryEntry } from './history.js';

/** Rate data for a time period. */
export interface PeriodRate {
  /** Period key (e.g., "2026-04-11", "2026-W15"). */
  readonly period: string;
  /** Number of recordings in this period. */
  readonly count: number;
  /** Success count. */
  readonly successCount: number;
  /** Average duration in this period. */
  readonly avgDuration: number;
}

/** Recording rate analysis result. */
export interface RateAnalysis {
  /** Daily recording rates. */
  readonly daily: readonly PeriodRate[];
  /** Weekly recording rates. */
  readonly weekly: readonly PeriodRate[];
  /** Overall recordings per day average. */
  readonly avgPerDay: number;
  /** Overall recordings per week average. */
  readonly avgPerWeek: number;
  /** Peak day (highest recording count). */
  readonly peakDay: PeriodRate | null;
  /** Peak week (highest recording count). */
  readonly peakWeek: PeriodRate | null;
  /** Velocity trend: comparing recent vs older periods. */
  readonly velocityTrend: 'accelerating' | 'stable' | 'decelerating';
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Total days spanned. */
  readonly totalDays: number;
}

/**
 * Analyze recording rates from history.
 */
export function analyzeRates(entries: readonly HistoryEntry[]): RateAnalysis {
  if (entries.length === 0) {
    return {
      daily: [],
      weekly: [],
      avgPerDay: 0,
      avgPerWeek: 0,
      peakDay: null,
      peakWeek: null,
      velocityTrend: 'stable',
      totalRecordings: 0,
      totalDays: 0,
    };
  }

  // Group by day
  const dailyMap = new Map<string, HistoryEntry[]>();
  const weeklyMap = new Map<string, HistoryEntry[]>();

  for (const e of entries) {
    const d = new Date(e.timestamp);
    const dayKey = d.toISOString().slice(0, 10);
    const weekKey = getWeekKey(d);

    const dayList = dailyMap.get(dayKey) ?? [];
    dayList.push(e);
    dailyMap.set(dayKey, dayList);

    const weekList = weeklyMap.get(weekKey) ?? [];
    weekList.push(e);
    weeklyMap.set(weekKey, weekList);
  }

  const daily = buildRates(dailyMap);
  const weekly = buildRates(weeklyMap);

  const timestamps = entries.map((e) => new Date(e.timestamp).getTime());
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  const totalDays = Math.max(1, Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)));

  const avgPerDay = Math.round((entries.length / totalDays) * 100) / 100;
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const avgPerWeek = Math.round((entries.length / totalWeeks) * 100) / 100;

  const peakDay = daily.length > 0
    ? daily.reduce((best, d) => d.count > best.count ? d : best)
    : null;
  const peakWeek = weekly.length > 0
    ? weekly.reduce((best, w) => w.count > best.count ? w : best)
    : null;

  const velocityTrend = computeVelocityTrend(daily);

  return {
    daily,
    weekly,
    avgPerDay,
    avgPerWeek,
    peakDay,
    peakWeek,
    velocityTrend,
    totalRecordings: entries.length,
    totalDays,
  };
}

function getWeekKey(d: Date): string {
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.ceil((dayOfYear + start.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function buildRates(map: Map<string, HistoryEntry[]>): PeriodRate[] {
  const rates: PeriodRate[] = [];
  for (const [period, group] of map) {
    const successCount = group.filter((e) => e.status === 'ok').length;
    const avgDuration = Math.round(
      (group.reduce((s, e) => s + e.durationSeconds, 0) / group.length) * 100,
    ) / 100;
    rates.push({ period, count: group.length, successCount, avgDuration });
  }
  return rates.sort((a, b) => a.period.localeCompare(b.period));
}

function computeVelocityTrend(daily: readonly PeriodRate[]): RateAnalysis['velocityTrend'] {
  if (daily.length < 4) return 'stable';

  const mid = Math.floor(daily.length / 2);
  const firstHalf = daily.slice(0, mid);
  const secondHalf = daily.slice(mid);

  const avgFirst = firstHalf.reduce((s, d) => s + d.count, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, d) => s + d.count, 0) / secondHalf.length;

  const changePct = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;

  if (changePct > 20) return 'accelerating';
  if (changePct < -20) return 'decelerating';
  return 'stable';
}

/**
 * Format rate analysis report.
 */
export function formatRateAnalysis(result: RateAnalysis): string {
  const lines: string[] = [];
  lines.push('Recording Rate Analysis');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings to analyze.');
    return lines.join('\n');
  }

  const trendIcons = { accelerating: '📈', stable: '➡️', decelerating: '📉' };

  lines.push(`  Total recordings: ${result.totalRecordings}`);
  lines.push(`  Period:           ${result.totalDays} days`);
  lines.push(`  Avg per day:      ${result.avgPerDay}`);
  lines.push(`  Avg per week:     ${result.avgPerWeek}`);
  lines.push(`  Velocity:         ${trendIcons[result.velocityTrend]} ${result.velocityTrend}`);
  lines.push('');

  if (result.peakDay) {
    lines.push(`  Peak day:  ${result.peakDay.period} (${result.peakDay.count} recordings)`);
  }
  if (result.peakWeek) {
    lines.push(`  Peak week: ${result.peakWeek.period} (${result.peakWeek.count} recordings)`);
  }

  if (result.daily.length > 0) {
    lines.push('');
    lines.push('  Daily rates:');
    for (const d of result.daily.slice(-7)) {
      const bar = '█'.repeat(Math.min(40, d.count));
      lines.push(`    ${d.period}  ${d.count.toString().padStart(4)} ${bar}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
