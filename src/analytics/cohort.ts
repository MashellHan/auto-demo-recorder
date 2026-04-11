/**
 * Recording cohort analysis — groups scenarios into time-based cohorts
 * (by week they first appeared) and tracks activity/quality across periods.
 */

import type { HistoryEntry } from './history.js';

/** Cohort granularity. */
export type CohortGranularity = 'weekly' | 'monthly';

/** Activity data for one cohort in one period. */
export interface CohortPeriodData {
  /** Period label (e.g., "Week 2", "Month 3"). */
  readonly period: string;
  /** Period index (0 = cohort's first period). */
  readonly periodIndex: number;
  /** Number of recordings in this period. */
  readonly recordings: number;
  /** Success rate (0-100). */
  readonly successRate: number;
  /** Number of active scenarios from this cohort. */
  readonly activeScenarios: number;
  /** Retention rate compared to period 0 (0-100). */
  readonly retentionRate: number;
}

/** A single cohort (group of scenarios that first appeared together). */
export interface Cohort {
  /** Cohort label (e.g., "2026-W14", "2026-03"). */
  readonly label: string;
  /** Scenarios in this cohort. */
  readonly scenarios: readonly string[];
  /** First appearance date (ISO). */
  readonly firstSeen: string;
  /** Activity data across periods. */
  readonly periods: readonly CohortPeriodData[];
}

/** Complete cohort analysis result. */
export interface CohortResult {
  /** Granularity used. */
  readonly granularity: CohortGranularity;
  /** Total unique scenarios analyzed. */
  readonly totalScenarios: number;
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Individual cohorts. */
  readonly cohorts: readonly Cohort[];
  /** Average retention rate at period 1 (first re-engagement). */
  readonly avgRetentionPeriod1: number;
  /** Whether there is enough data. */
  readonly hasData: boolean;
}

/**
 * Get week label (ISO week) for a date.
 */
function getWeekLabel(d: Date): string {
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const weekNum = Math.ceil(dayOfYear / 7);
  return `${year}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Get month label for a date.
 */
function getMonthLabel(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/**
 * Get period label for a date.
 */
function getPeriodLabel(d: Date, granularity: CohortGranularity): string {
  return granularity === 'weekly' ? getWeekLabel(d) : getMonthLabel(d);
}

/**
 * Analyze recording cohorts.
 */
export function analyzeCohorts(
  entries: readonly HistoryEntry[],
  granularity: CohortGranularity = 'weekly',
): CohortResult {
  if (entries.length === 0) {
    return {
      granularity,
      totalScenarios: 0,
      totalRecordings: 0,
      cohorts: [],
      avgRetentionPeriod1: 0,
      hasData: false,
    };
  }

  // Find first appearance period for each scenario
  const firstSeen = new Map<string, { period: string; date: string }>();
  const sorted = [...entries].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  for (const e of sorted) {
    if (!firstSeen.has(e.scenario)) {
      const d = new Date(e.timestamp);
      firstSeen.set(e.scenario, {
        period: getPeriodLabel(d, granularity),
        date: e.timestamp.slice(0, 10),
      });
    }
  }

  // Group scenarios into cohorts by first-seen period
  const cohortMap = new Map<string, { scenarios: string[]; firstDate: string }>();
  for (const [scenario, info] of firstSeen) {
    const existing = cohortMap.get(info.period);
    if (existing) {
      existing.scenarios.push(scenario);
      if (info.date < existing.firstDate) existing.firstDate = info.date;
    } else {
      cohortMap.set(info.period, { scenarios: [scenario], firstDate: info.date });
    }
  }

  // Collect all unique periods in order
  const allPeriods = new Set<string>();
  for (const e of sorted) {
    allPeriods.add(getPeriodLabel(new Date(e.timestamp), granularity));
  }
  const periodList = [...allPeriods].sort();

  // Build cohort data
  const cohorts: Cohort[] = [];
  for (const [cohortPeriod, cohortInfo] of [...cohortMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const cohortScenarios = new Set(cohortInfo.scenarios);

    // Find cohort start index in period list
    const startIdx = periodList.indexOf(cohortPeriod);
    if (startIdx < 0) continue;

    const periods: CohortPeriodData[] = [];
    let period0ActiveCount = 0;

    for (let i = startIdx; i < periodList.length; i++) {
      const period = periodList[i]!;
      const periodIndex = i - startIdx;

      // Filter entries for this cohort's scenarios in this period
      const periodEntries = sorted.filter((e) => {
        if (!cohortScenarios.has(e.scenario)) return false;
        return getPeriodLabel(new Date(e.timestamp), granularity) === period;
      });

      const recordings = periodEntries.length;
      const okCount = periodEntries.filter((e) => e.status === 'ok').length;
      const successRate = recordings > 0 ? round2((okCount / recordings) * 100) : 0;

      // Active scenarios = scenarios with at least 1 recording in this period
      const activeScenariosInPeriod = new Set(periodEntries.map((e) => e.scenario));
      const activeScenarios = activeScenariosInPeriod.size;

      if (periodIndex === 0) period0ActiveCount = activeScenarios;

      const retentionRate = period0ActiveCount > 0
        ? round2((activeScenarios / period0ActiveCount) * 100)
        : 0;

      const periodLabel = granularity === 'weekly'
        ? `Week ${periodIndex}`
        : `Month ${periodIndex}`;

      periods.push({
        period: periodLabel,
        periodIndex,
        recordings,
        successRate,
        activeScenarios,
        retentionRate,
      });
    }

    cohorts.push({
      label: cohortPeriod,
      scenarios: cohortInfo.scenarios.sort(),
      firstSeen: cohortInfo.firstDate,
      periods,
    });
  }

  // Compute average retention at period 1
  const period1Retentions = cohorts
    .map((c) => c.periods.find((p) => p.periodIndex === 1))
    .filter((p): p is CohortPeriodData => p !== undefined)
    .map((p) => p.retentionRate);

  const avgRetentionPeriod1 = period1Retentions.length > 0
    ? round2(period1Retentions.reduce((s, v) => s + v, 0) / period1Retentions.length)
    : 0;

  return {
    granularity,
    totalScenarios: firstSeen.size,
    totalRecordings: entries.length,
    cohorts,
    avgRetentionPeriod1,
    hasData: true,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Format cohort analysis as a readable report.
 */
export function formatCohorts(result: CohortResult): string {
  const lines: string[] = [];
  const granLabel = result.granularity === 'weekly' ? 'Weekly' : 'Monthly';

  lines.push(`${granLabel} Cohort Analysis`);
  lines.push('═'.repeat(60));
  lines.push(`  Scenarios:         ${result.totalScenarios}`);
  lines.push(`  Recordings:        ${result.totalRecordings}`);
  lines.push(`  Cohorts:           ${result.cohorts.length}`);

  if (!result.hasData) {
    lines.push('');
    lines.push('  No recording data available for cohort analysis.');
    return lines.join('\n');
  }

  if (result.avgRetentionPeriod1 > 0) {
    lines.push(`  Avg retention (P1): ${result.avgRetentionPeriod1}%`);
  }
  lines.push('');

  for (const cohort of result.cohorts) {
    lines.push(`  Cohort: ${cohort.label} (${cohort.scenarios.length} scenario(s))`);
    lines.push(`    Scenarios: ${cohort.scenarios.join(', ')}`);
    lines.push(`    First seen: ${cohort.firstSeen}`);

    if (cohort.periods.length > 0) {
      lines.push('    Period     Recordings  Success  Active  Retention');
      lines.push('    ────────── ────────── ──────── ─────── ─────────');
      for (const p of cohort.periods) {
        const rec = p.recordings.toString().padStart(10);
        const rate = `${p.successRate}%`.padStart(7);
        const active = p.activeScenarios.toString().padStart(7);
        const ret = `${p.retentionRate}%`.padStart(9);
        lines.push(`    ${p.period.padEnd(10)} ${rec} ${rate} ${active} ${ret}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
