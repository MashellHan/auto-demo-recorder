/**
 * Recording health dashboard — unified at-a-glance overview combining
 * success rate, duration stats, freshness, alerts, and velocity.
 */

import type { HistoryEntry } from './history.js';

/** Overall health grade. */
export type HealthGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/** Health dashboard result. */
export interface HealthDashboard {
  /** Overall health grade. */
  readonly grade: HealthGrade;
  /** Overall health score (0-100). */
  readonly score: number;
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Success rate (0-100). */
  readonly successRate: number;
  /** Average duration in seconds. */
  readonly avgDuration: number;
  /** Unique scenario count. */
  readonly scenarioCount: number;
  /** Scenarios with 100% failure rate. */
  readonly failingScenarios: readonly string[];
  /** Days since most recent recording (0 = today). */
  readonly daysSinceLastRecording: number;
  /** Recent trend direction. */
  readonly trend: 'improving' | 'stable' | 'degrading';
  /** Per-scenario mini health status. */
  readonly scenarios: readonly ScenarioHealth[];
}

/** Per-scenario health. */
export interface ScenarioHealth {
  /** Scenario name. */
  readonly name: string;
  /** Number of recordings. */
  readonly count: number;
  /** Success rate (0-100). */
  readonly successRate: number;
  /** Average duration. */
  readonly avgDuration: number;
  /** Most recent status. */
  readonly lastStatus: string;
  /** Health grade for this scenario. */
  readonly grade: HealthGrade;
}

/**
 * Compute recording health dashboard.
 */
export function computeHealthDashboard(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
): HealthDashboard {
  if (entries.length === 0) {
    return {
      grade: 'critical',
      score: 0,
      totalRecordings: 0,
      successRate: 0,
      avgDuration: 0,
      scenarioCount: 0,
      failingScenarios: [],
      daysSinceLastRecording: -1,
      trend: 'stable',
      scenarios: [],
    };
  }

  // Overall stats
  const okCount = entries.filter((e) => e.status === 'ok').length;
  const successRate = round2((okCount / entries.length) * 100);
  const avgDuration = round2(
    entries.reduce((s, e) => s + e.durationSeconds, 0) / entries.length,
  );

  // Scenarios
  const scenarioMap = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = scenarioMap.get(e.scenario) ?? [];
    list.push(e);
    scenarioMap.set(e.scenario, list);
  }

  const scenarios: ScenarioHealth[] = [];
  const failingScenarios: string[] = [];

  for (const [name, group] of scenarioMap) {
    const sOk = group.filter((e) => e.status === 'ok').length;
    const sRate = round2((sOk / group.length) * 100);
    const sAvg = round2(
      group.reduce((s, e) => s + e.durationSeconds, 0) / group.length,
    );
    const sorted = [...group].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const lastStatus = sorted[0].status;
    const grade = gradeFromSuccessRate(sRate);

    scenarios.push({ name, count: group.length, successRate: sRate, avgDuration: sAvg, lastStatus, grade });

    if (sRate === 0) {
      failingScenarios.push(name);
    }
  }

  scenarios.sort((a, b) => a.successRate - b.successRate);

  // Days since last recording
  const timestamps = entries.map((e) => new Date(e.timestamp).getTime());
  const latest = Math.max(...timestamps);
  const daysSinceLastRecording = Math.floor(
    (now.getTime() - latest) / (1000 * 60 * 60 * 24),
  );

  // Trend detection (compare first half vs second half success rates)
  const trend = computeTrend(entries);

  // Score: weighted combination
  const recencyScore = daysSinceLastRecording <= 0 ? 100
    : daysSinceLastRecording <= 1 ? 90
    : daysSinceLastRecording <= 7 ? 70
    : daysSinceLastRecording <= 30 ? 40
    : 10;

  const failPenalty = Math.min(30, failingScenarios.length * 10);
  const score = Math.max(0, Math.min(100, Math.round(
    successRate * 0.5 + recencyScore * 0.3 + (100 - failPenalty) * 0.2,
  )));

  const grade = scoreToGrade(score);

  return {
    grade,
    score,
    totalRecordings: entries.length,
    successRate,
    avgDuration,
    scenarioCount: scenarioMap.size,
    failingScenarios,
    daysSinceLastRecording,
    trend,
    scenarios,
  };
}

function gradeFromSuccessRate(rate: number): HealthGrade {
  if (rate >= 95) return 'excellent';
  if (rate >= 80) return 'good';
  if (rate >= 60) return 'fair';
  if (rate >= 30) return 'poor';
  return 'critical';
}

function scoreToGrade(score: number): HealthGrade {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

function computeTrend(entries: readonly HistoryEntry[]): HealthDashboard['trend'] {
  if (entries.length < 4) return 'stable';

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const mid = Math.floor(sorted.length / 2);
  const first = sorted.slice(0, mid);
  const second = sorted.slice(mid);

  const rateFirst = first.filter((e) => e.status === 'ok').length / first.length;
  const rateSecond = second.filter((e) => e.status === 'ok').length / second.length;

  const diff = rateSecond - rateFirst;
  if (diff > 0.1) return 'improving';
  if (diff < -0.1) return 'degrading';
  return 'stable';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Format health dashboard report.
 */
export function formatHealthDashboard(result: HealthDashboard): string {
  const lines: string[] = [];
  const gradeIcons: Record<HealthGrade, string> = {
    excellent: '🟢',
    good: '🔵',
    fair: '🟡',
    poor: '🟠',
    critical: '🔴',
  };
  const trendIcons = { improving: '📈', stable: '➡️', degrading: '📉' };

  lines.push('Recording Health Dashboard');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings found.');
    return lines.join('\n');
  }

  lines.push(`  ${gradeIcons[result.grade]} Overall: ${result.grade.toUpperCase()} (${result.score}/100)`);
  lines.push('');
  lines.push(`  Total recordings:  ${result.totalRecordings}`);
  lines.push(`  Scenarios:         ${result.scenarioCount}`);
  lines.push(`  Success rate:      ${result.successRate}%`);
  lines.push(`  Avg duration:      ${result.avgDuration}s`);
  lines.push(`  Last recording:    ${result.daysSinceLastRecording === 0 ? 'today' : `${result.daysSinceLastRecording}d ago`}`);
  lines.push(`  Trend:             ${trendIcons[result.trend]} ${result.trend}`);

  if (result.failingScenarios.length > 0) {
    lines.push('');
    lines.push(`  ⚠ Failing scenarios (${result.failingScenarios.length}):`);
    for (const name of result.failingScenarios) {
      lines.push(`    🔴 ${name}`);
    }
  }

  if (result.scenarios.length > 0) {
    lines.push('');
    lines.push('  Per-Scenario Health:');
    for (const s of result.scenarios) {
      const icon = gradeIcons[s.grade];
      lines.push(`    ${icon} ${s.name.padEnd(20)} ${s.successRate.toString().padStart(5)}%  ${s.avgDuration.toString().padStart(6)}s  ${s.count} rec  last: ${s.lastStatus}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
