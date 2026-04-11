/**
 * Scenario risk scoring — combine failure rate, duration volatility,
 * and recording staleness into a unified risk score (0-100) per scenario.
 *
 * Higher score = higher risk / needs more attention.
 */

import type { HistoryEntry } from './history.js';

/** Risk level classification. */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Risk score for a single scenario. */
export interface ScenarioRisk {
  /** Scenario name. */
  readonly name: string;
  /** Overall risk score (0-100). */
  readonly riskScore: number;
  /** Risk level classification. */
  readonly riskLevel: RiskLevel;
  /** Component scores. */
  readonly factors: {
    /** Failure rate factor (0-40). */
    readonly failureRate: number;
    /** Duration volatility factor (0-25). */
    readonly volatility: number;
    /** Staleness factor (0-20). */
    readonly staleness: number;
    /** Recency of failures factor (0-15). */
    readonly recentFailures: number;
  };
  /** Number of recordings. */
  readonly recordingCount: number;
  /** Failure rate percentage. */
  readonly failureRatePct: number;
  /** Standard deviation of duration. */
  readonly durationStdDev: number;
  /** Hours since last recording. */
  readonly hoursSinceLastRecording: number;
}

/** Risk scoring result. */
export interface RiskResult {
  /** Per-scenario risk scores. */
  readonly scenarios: readonly ScenarioRisk[];
  /** Average risk score. */
  readonly averageRisk: number;
  /** Number of high/critical risk scenarios. */
  readonly highRiskCount: number;
  /** Total scenarios. */
  readonly totalScenarios: number;
  /** Risk distribution. */
  readonly distribution: {
    readonly low: number;
    readonly medium: number;
    readonly high: number;
    readonly critical: number;
  };
}

/**
 * Compute risk scores for all scenarios.
 */
export function computeRiskScores(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
): RiskResult {
  if (entries.length === 0) {
    return {
      scenarios: [],
      averageRisk: 0,
      highRiskCount: 0,
      totalScenarios: 0,
      distribution: { low: 0, medium: 0, high: 0, critical: 0 },
    };
  }

  // Group by scenario
  const scenarioMap = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = scenarioMap.get(e.scenario) ?? [];
    list.push(e);
    scenarioMap.set(e.scenario, list);
  }

  const scenarios: ScenarioRisk[] = [];

  for (const [name, group] of scenarioMap) {
    const risk = computeScenarioRisk(name, group, now);
    scenarios.push(risk);
  }

  // Sort by risk descending
  scenarios.sort((a, b) => b.riskScore - a.riskScore);

  const averageRisk = scenarios.length > 0
    ? Math.round((scenarios.reduce((s, r) => s + r.riskScore, 0) / scenarios.length) * 100) / 100
    : 0;

  const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const s of scenarios) {
    distribution[s.riskLevel]++;
  }

  const highRiskCount = distribution.high + distribution.critical;

  return {
    scenarios,
    averageRisk,
    highRiskCount,
    totalScenarios: scenarios.length,
    distribution,
  };
}

function computeScenarioRisk(
  name: string,
  group: HistoryEntry[],
  now: Date,
): ScenarioRisk {
  // Failure rate (0-40 points)
  const errorCount = group.filter((e) => e.status !== 'ok').length;
  const failureRatePct = Math.round((errorCount / group.length) * 10000) / 100;
  const failureRate = Math.min(40, Math.round(failureRatePct * 0.4));

  // Duration volatility (0-25 points)
  const durations = group.map((e) => e.durationSeconds);
  const mean = durations.reduce((s, d) => s + d, 0) / durations.length;
  const variance = durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length;
  const durationStdDev = Math.round(Math.sqrt(variance) * 100) / 100;
  const cv = mean > 0 ? durationStdDev / mean : 0;
  const volatility = Math.min(25, Math.round(cv * 50));

  // Staleness (0-20 points)
  const timestamps = group.map((e) => new Date(e.timestamp).getTime());
  const latest = Math.max(...timestamps);
  const hoursSinceLastRecording = Math.round(
    (now.getTime() - latest) / (1000 * 60 * 60),
  );
  const staleness = hoursSinceLastRecording <= 24 ? 0
    : hoursSinceLastRecording <= 72 ? 5
    : hoursSinceLastRecording <= 168 ? 10
    : hoursSinceLastRecording <= 720 ? 15
    : 20;

  // Recent failures (0-15 points)
  const sorted = [...group].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const recentCount = Math.min(5, sorted.length);
  const recentErrors = sorted.slice(0, recentCount).filter((e) => e.status !== 'ok').length;
  const recentFailures = Math.round((recentErrors / recentCount) * 15);

  const riskScore = Math.min(100, failureRate + volatility + staleness + recentFailures);
  const riskLevel = classifyRisk(riskScore);

  return {
    name,
    riskScore,
    riskLevel,
    factors: { failureRate, volatility, staleness, recentFailures },
    recordingCount: group.length,
    failureRatePct,
    durationStdDev,
    hoursSinceLastRecording,
  };
}

function classifyRisk(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

/**
 * Format risk score report.
 */
export function formatRiskScores(result: RiskResult): string {
  const lines: string[] = [];
  const levelIcons: Record<RiskLevel, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  lines.push('Scenario Risk Scores');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalScenarios === 0) {
    lines.push('  No scenarios to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Average risk:    ${result.averageRisk}/100`);
  lines.push(`  High/Critical:   ${result.highRiskCount} scenario(s)`);
  lines.push(`  Distribution:    🟢 ${result.distribution.low} low, 🟡 ${result.distribution.medium} medium, 🟠 ${result.distribution.high} high, 🔴 ${result.distribution.critical} critical`);
  lines.push('');

  lines.push('  Risk per scenario:');
  for (const s of result.scenarios) {
    const icon = levelIcons[s.riskLevel];
    lines.push(
      `    ${icon} ${s.name.padEnd(20)} ${s.riskScore.toString().padStart(3)}/100  ` +
      `fail=${s.factors.failureRate} vol=${s.factors.volatility} stale=${s.factors.staleness} recent=${s.factors.recentFailures}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}
