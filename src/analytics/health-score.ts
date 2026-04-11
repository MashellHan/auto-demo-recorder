/**
 * Composite recording health score — aggregates multiple quality dimensions
 * into a single 0-100 score with per-dimension breakdown.
 */

import type { HistoryEntry } from './history.js';

/** A single scored dimension. */
export interface HealthDimension {
  /** Dimension name. */
  readonly name: string;
  /** Score (0-100). */
  readonly score: number;
  /** Weight used in composite. */
  readonly weight: number;
  /** Weighted contribution to total. */
  readonly contribution: number;
  /** Human-readable explanation. */
  readonly detail: string;
}

/** Overall health grade. */
export type HealthScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Complete health score result. */
export interface HealthScoreResult {
  /** Composite score (0-100). */
  readonly score: number;
  /** Letter grade. */
  readonly grade: HealthScoreGrade;
  /** Per-dimension scores. */
  readonly dimensions: readonly HealthDimension[];
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Analysis window in days. */
  readonly windowDays: number;
  /** Whether there is enough data. */
  readonly hasData: boolean;
}

/** Dimension weights (must sum to 1.0). */
const WEIGHTS = {
  successRate: 0.30,
  coverage: 0.20,
  freshness: 0.20,
  consistency: 0.15,
  volume: 0.15,
} as const;

/**
 * Compute composite recording health score.
 */
export function computeHealthScore(
  entries: readonly HistoryEntry[],
  windowDays: number = 30,
  now: Date = new Date(),
): HealthScoreResult {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const windowEntries = entries.filter((e) =>
    new Date(e.timestamp).getTime() > cutoff && new Date(e.timestamp).getTime() <= now.getTime(),
  );

  if (windowEntries.length === 0) {
    return {
      score: 0,
      grade: 'F',
      dimensions: buildEmptyDimensions(),
      totalRecordings: 0,
      windowDays,
      hasData: false,
    };
  }

  const dimensions: HealthDimension[] = [];

  // 1. Success Rate (weight: 30%)
  const okCount = windowEntries.filter((e) => e.status === 'ok').length;
  const successRate = (okCount / windowEntries.length) * 100;
  const successScore = Math.min(100, successRate);
  dimensions.push({
    name: 'Success Rate',
    score: round2(successScore),
    weight: WEIGHTS.successRate,
    contribution: round2(successScore * WEIGHTS.successRate),
    detail: `${round2(successRate)}% success (${okCount}/${windowEntries.length})`,
  });

  // 2. Coverage (weight: 20%) — based on unique scenarios
  const uniqueScenarios = new Set(windowEntries.map((e) => e.scenario));
  const allScenarios = new Set(entries.map((e) => e.scenario));
  const coverageRatio = allScenarios.size > 0
    ? uniqueScenarios.size / allScenarios.size
    : 0;
  const coverageScore = Math.min(100, coverageRatio * 100);
  dimensions.push({
    name: 'Coverage',
    score: round2(coverageScore),
    weight: WEIGHTS.coverage,
    contribution: round2(coverageScore * WEIGHTS.coverage),
    detail: `${uniqueScenarios.size}/${allScenarios.size} scenarios active`,
  });

  // 3. Freshness (weight: 20%) — how recently scenarios were recorded
  const scenarioLastSeen = new Map<string, number>();
  for (const e of windowEntries) {
    const t = new Date(e.timestamp).getTime();
    const prev = scenarioLastSeen.get(e.scenario) ?? 0;
    if (t > prev) scenarioLastSeen.set(e.scenario, t);
  }
  const maxStaleDays = windowDays;
  let freshnessSum = 0;
  for (const lastSeen of scenarioLastSeen.values()) {
    const ageDays = (now.getTime() - lastSeen) / (24 * 60 * 60 * 1000);
    const freshness = Math.max(0, 1 - ageDays / maxStaleDays);
    freshnessSum += freshness;
  }
  const freshnessScore = scenarioLastSeen.size > 0
    ? Math.min(100, (freshnessSum / scenarioLastSeen.size) * 100)
    : 0;
  dimensions.push({
    name: 'Freshness',
    score: round2(freshnessScore),
    weight: WEIGHTS.freshness,
    contribution: round2(freshnessScore * WEIGHTS.freshness),
    detail: `${scenarioLastSeen.size} scenario(s) analyzed`,
  });

  // 4. Consistency (weight: 15%) — daily recording variance (lower CV = higher score)
  const byDate = new Map<string, number>();
  for (const e of windowEntries) {
    const date = e.timestamp.slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
  }
  const dailyCounts = [...byDate.values()];
  let consistencyScore = 100;
  if (dailyCounts.length > 1) {
    const mean = dailyCounts.reduce((s, v) => s + v, 0) / dailyCounts.length;
    const variance = dailyCounts.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyCounts.length;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? stddev / mean : 0;
    // CV of 0 = 100%, CV of 1+ = 0%
    consistencyScore = Math.max(0, Math.min(100, (1 - cv) * 100));
  }
  dimensions.push({
    name: 'Consistency',
    score: round2(consistencyScore),
    weight: WEIGHTS.consistency,
    contribution: round2(consistencyScore * WEIGHTS.consistency),
    detail: `${byDate.size} active day(s), CV=${dailyCounts.length > 1 ? round2(Math.sqrt(dailyCounts.reduce((s, v) => s + (v - dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length) ** 2, 0) / dailyCounts.length) / (dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length)) : 0}`,
  });

  // 5. Volume (weight: 15%) — recordings per day compared to expected
  const activeDays = byDate.size;
  const perDayRate = activeDays > 0 ? windowEntries.length / activeDays : 0;
  // Score: 5+/day = 100%, scales linearly from 0
  const volumeScore = Math.min(100, (perDayRate / 5) * 100);
  dimensions.push({
    name: 'Volume',
    score: round2(volumeScore),
    weight: WEIGHTS.volume,
    contribution: round2(volumeScore * WEIGHTS.volume),
    detail: `${round2(perDayRate)} recordings/active day`,
  });

  // Composite score
  const score = round2(dimensions.reduce((s, d) => s + d.contribution, 0));
  const grade = scoreToGrade(score);

  return {
    score,
    grade,
    dimensions,
    totalRecordings: windowEntries.length,
    windowDays,
    hasData: true,
  };
}

function scoreToGrade(score: number): HealthScoreGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function buildEmptyDimensions(): HealthDimension[] {
  return [
    { name: 'Success Rate', score: 0, weight: WEIGHTS.successRate, contribution: 0, detail: 'No data' },
    { name: 'Coverage', score: 0, weight: WEIGHTS.coverage, contribution: 0, detail: 'No data' },
    { name: 'Freshness', score: 0, weight: WEIGHTS.freshness, contribution: 0, detail: 'No data' },
    { name: 'Consistency', score: 0, weight: WEIGHTS.consistency, contribution: 0, detail: 'No data' },
    { name: 'Volume', score: 0, weight: WEIGHTS.volume, contribution: 0, detail: 'No data' },
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Format health score as a readable report.
 */
export function formatHealthScore(result: HealthScoreResult): string {
  const lines: string[] = [];

  const gradeIcon = result.grade === 'A' ? '🏆' : result.grade === 'B' ? '✅' : result.grade === 'C' ? '⚠️' : result.grade === 'D' ? '🟡' : '🔴';

  lines.push('Recording Health Score');
  lines.push('═'.repeat(60));
  lines.push(`  Overall:  ${gradeIcon} ${result.score}/100 (Grade ${result.grade})`);
  lines.push(`  Window:   ${result.windowDays} days`);
  lines.push(`  Records:  ${result.totalRecordings}`);
  lines.push('');

  if (!result.hasData) {
    lines.push('  No recording data available.');
    return lines.join('\n');
  }

  lines.push('  Dimensions:');
  lines.push('    Dimension       Score  Weight  Contrib  Detail');
  lines.push('    ─────────────── ────── ─────── ─────── ──────────────────────');
  for (const d of result.dimensions) {
    const name = d.name.padEnd(15);
    const score = d.score.toFixed(1).padStart(5);
    const weight = `${(d.weight * 100).toFixed(0)}%`.padStart(6);
    const contrib = d.contribution.toFixed(1).padStart(7);
    lines.push(`    ${name} ${score} ${weight} ${contrib}  ${d.detail}`);
  }
  lines.push('');

  // Score bar
  const filled = Math.round(result.score / 5);
  const empty = 20 - filled;
  lines.push(`  ${'█'.repeat(filled)}${'░'.repeat(empty)} ${result.score}%`);
  lines.push('');

  return lines.join('\n');
}
