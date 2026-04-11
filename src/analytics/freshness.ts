/**
 * Recording freshness index — compute how recently each scenario
 * was recorded and assign a staleness score.
 *
 * Freshness grades:
 * - fresh:   recorded within the last day
 * - recent:  recorded within the last 3 days
 * - aging:   recorded within the last 7 days
 * - stale:   recorded within the last 30 days
 * - expired: not recorded in 30+ days
 */

import type { HistoryEntry } from './history.js';

/** Freshness grade. */
export type FreshnessGrade = 'fresh' | 'recent' | 'aging' | 'stale' | 'expired';

/** Freshness info for a single scenario. */
export interface ScenarioFreshness {
  /** Scenario name. */
  readonly scenario: string;
  /** Freshness grade. */
  readonly grade: FreshnessGrade;
  /** Hours since last recording. */
  readonly hoursSinceLastRecording: number;
  /** Last recording timestamp. */
  readonly lastRecorded: string;
  /** Total recording count. */
  readonly totalRecordings: number;
  /** Average recordings per day (over analyzed period). */
  readonly avgRecordingsPerDay: number;
  /** Staleness score (0-100, 100 = most stale). */
  readonly stalenessScore: number;
}

/** Freshness index result. */
export interface FreshnessResult {
  /** Per-scenario freshness data. */
  readonly scenarios: readonly ScenarioFreshness[];
  /** Summary by grade. */
  readonly summary: Record<FreshnessGrade, number>;
  /** Overall freshness score (0-100, 100 = all fresh). */
  readonly overallScore: number;
  /** Analysis timestamp. */
  readonly analyzedAt: string;
}

/**
 * Compute freshness index from recording history.
 */
export function computeFreshness(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
): FreshnessResult {
  const groups = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.scenario) ?? [];
    list.push(e);
    groups.set(e.scenario, list);
  }

  const scenarios: ScenarioFreshness[] = [];
  const nowMs = now.getTime();

  for (const [scenario, group] of groups) {
    const timestamps = group.map((e) => new Date(e.timestamp).getTime());
    const latest = Math.max(...timestamps);
    const earliest = Math.min(...timestamps);
    const hoursSince = (nowMs - latest) / (1000 * 60 * 60);
    const spanDays = Math.max(1, (nowMs - earliest) / (1000 * 60 * 60 * 24));

    scenarios.push({
      scenario,
      grade: classifyFreshness(hoursSince),
      hoursSinceLastRecording: Math.round(hoursSince * 10) / 10,
      lastRecorded: new Date(latest).toISOString(),
      totalRecordings: group.length,
      avgRecordingsPerDay: Math.round((group.length / spanDays) * 100) / 100,
      stalenessScore: computeStalenessScore(hoursSince),
    });
  }

  scenarios.sort((a, b) => b.stalenessScore - a.stalenessScore);

  const summary: Record<FreshnessGrade, number> = {
    fresh: 0, recent: 0, aging: 0, stale: 0, expired: 0,
  };
  for (const s of scenarios) {
    summary[s.grade]++;
  }

  const totalScore = scenarios.length > 0
    ? scenarios.reduce((sum, s) => sum + (100 - s.stalenessScore), 0) / scenarios.length
    : 0;

  return {
    scenarios,
    summary,
    overallScore: Math.round(totalScore),
    analyzedAt: now.toISOString(),
  };
}

function classifyFreshness(hoursSince: number): FreshnessGrade {
  if (hoursSince <= 24) return 'fresh';
  if (hoursSince <= 72) return 'recent';
  if (hoursSince <= 168) return 'aging';
  if (hoursSince <= 720) return 'stale';
  return 'expired';
}

function computeStalenessScore(hoursSince: number): number {
  // 0 hours → 0 (fresh), 720+ hours → 100 (expired)
  return Math.min(100, Math.round((hoursSince / 720) * 100));
}

/**
 * Format freshness index report.
 */
export function formatFreshness(result: FreshnessResult): string {
  const lines: string[] = [];
  lines.push('Recording Freshness Index');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.scenarios.length === 0) {
    lines.push('  No recordings found.');
    return lines.join('\n');
  }

  const gradeIcons: Record<FreshnessGrade, string> = {
    fresh: '🟢', recent: '🔵', aging: '🟡', stale: '🟠', expired: '🔴',
  };

  lines.push(`  Overall freshness: ${result.overallScore}/100`);
  lines.push('');

  const gradeSummary = Object.entries(result.summary)
    .filter(([, count]) => count > 0)
    .map(([grade, count]) => `${gradeIcons[grade as FreshnessGrade]} ${grade}: ${count}`)
    .join('  ');
  lines.push(`  ${gradeSummary}`);
  lines.push('');

  lines.push(`  ${'Scenario'.padEnd(22)} ${'Grade'.padStart(8)} ${'Hours'.padStart(8)} ${'Staleness'.padStart(10)} ${'Recs/Day'.padStart(10)}`);
  lines.push('  ' + '─'.repeat(60));

  for (const s of result.scenarios) {
    const icon = gradeIcons[s.grade];
    lines.push(`  ${s.scenario.padEnd(22)} ${(icon + ' ' + s.grade).padStart(8)} ${s.hoursSinceLastRecording.toString().padStart(8)} ${(s.stalenessScore + '/100').padStart(10)} ${s.avgRecordingsPerDay.toString().padStart(10)}`);
  }

  lines.push('');
  return lines.join('\n');
}
