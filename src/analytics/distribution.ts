/**
 * Recording distribution analysis — analyze how recordings are distributed
 * across scenarios using Gini coefficient, identify under/over-recorded
 * scenarios, and compute an evenness score.
 */

import type { HistoryEntry } from './history.js';

/** Distribution info for a single scenario. */
export interface ScenarioDistribution {
  /** Scenario name. */
  readonly name: string;
  /** Number of recordings. */
  readonly count: number;
  /** Percentage of total recordings. */
  readonly percentage: number;
  /** Whether this scenario is under-recorded (below expected share). */
  readonly underRecorded: boolean;
  /** Whether this scenario is over-recorded (above expected share). */
  readonly overRecorded: boolean;
  /** Deviation from expected share (negative = under, positive = over). */
  readonly deviation: number;
}

/** Distribution analysis result. */
export interface DistributionResult {
  /** Per-scenario distribution. */
  readonly scenarios: readonly ScenarioDistribution[];
  /** Gini coefficient (0 = perfectly even, 1 = maximally uneven). */
  readonly giniCoefficient: number;
  /** Evenness score (0-100, inverse of Gini). */
  readonly evennessScore: number;
  /** Total recordings. */
  readonly totalRecordings: number;
  /** Total unique scenarios. */
  readonly scenarioCount: number;
  /** Expected recordings per scenario (if perfectly distributed). */
  readonly expectedPerScenario: number;
  /** Most recorded scenario. */
  readonly mostRecorded: ScenarioDistribution | null;
  /** Least recorded scenario. */
  readonly leastRecorded: ScenarioDistribution | null;
}

/**
 * Analyze recording distribution across scenarios.
 */
export function analyzeDistribution(entries: readonly HistoryEntry[]): DistributionResult {
  if (entries.length === 0) {
    return {
      scenarios: [],
      giniCoefficient: 0,
      evennessScore: 100,
      totalRecordings: 0,
      scenarioCount: 0,
      expectedPerScenario: 0,
      mostRecorded: null,
      leastRecorded: null,
    };
  }

  // Count per scenario
  const countMap = new Map<string, number>();
  for (const e of entries) {
    countMap.set(e.scenario, (countMap.get(e.scenario) ?? 0) + 1);
  }

  const scenarioCount = countMap.size;
  const expectedPerScenario = Math.round((entries.length / scenarioCount) * 100) / 100;
  const threshold = 0.5; // 50% deviation threshold

  const scenarios: ScenarioDistribution[] = [];
  for (const [name, count] of countMap) {
    const percentage = Math.round((count / entries.length) * 10000) / 100;
    const deviation = Math.round(((count - expectedPerScenario) / expectedPerScenario) * 10000) / 100;
    const underRecorded = count < expectedPerScenario * (1 - threshold);
    const overRecorded = count > expectedPerScenario * (1 + threshold);

    scenarios.push({ name, count, percentage, underRecorded, overRecorded, deviation });
  }

  // Sort by count descending
  scenarios.sort((a, b) => b.count - a.count);

  // Gini coefficient
  const counts = [...countMap.values()].sort((a, b) => a - b);
  const giniCoefficient = computeGini(counts);
  const evennessScore = Math.round((1 - giniCoefficient) * 100);

  const mostRecorded = scenarios.length > 0 ? scenarios[0] : null;
  const leastRecorded = scenarios.length > 0 ? scenarios[scenarios.length - 1] : null;

  return {
    scenarios,
    giniCoefficient,
    evennessScore,
    totalRecordings: entries.length,
    scenarioCount,
    expectedPerScenario,
    mostRecorded,
    leastRecorded,
  };
}

/**
 * Compute Gini coefficient from sorted values.
 */
function computeGini(sortedValues: readonly number[]): number {
  const n = sortedValues.length;
  if (n <= 1) return 0;

  const sum = sortedValues.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sortedValues[i];
  }

  const gini = numerator / (n * sum);
  return Math.round(gini * 1000) / 1000;
}

/**
 * Format distribution report.
 */
export function formatDistribution(result: DistributionResult): string {
  const lines: string[] = [];
  lines.push('Recording Distribution Analysis');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings to analyze.');
    return lines.join('\n');
  }

  const evennessIcon = result.evennessScore >= 80 ? '🟢'
    : result.evennessScore >= 60 ? '🟡'
    : '🔴';

  lines.push(`  Total recordings:     ${result.totalRecordings}`);
  lines.push(`  Scenarios:            ${result.scenarioCount}`);
  lines.push(`  Expected per scenario: ${result.expectedPerScenario}`);
  lines.push(`  Gini coefficient:     ${result.giniCoefficient} (0=even, 1=uneven)`);
  lines.push(`  Evenness:             ${evennessIcon} ${result.evennessScore}%`);
  lines.push('');

  if (result.mostRecorded) {
    lines.push(`  Most recorded:  ${result.mostRecorded.name} (${result.mostRecorded.count}, ${result.mostRecorded.percentage}%)`);
  }
  if (result.leastRecorded) {
    lines.push(`  Least recorded: ${result.leastRecorded.name} (${result.leastRecorded.count}, ${result.leastRecorded.percentage}%)`);
  }

  lines.push('');
  lines.push('  Distribution:');
  const maxCount = Math.max(...result.scenarios.map((s) => s.count));
  for (const s of result.scenarios) {
    const barLen = maxCount > 0 ? Math.round((s.count / maxCount) * 30) : 0;
    const bar = '█'.repeat(barLen);
    const flag = s.underRecorded ? ' ⬇' : s.overRecorded ? ' ⬆' : '';
    lines.push(`    ${s.name.padEnd(20)} ${s.count.toString().padStart(5)}  ${s.percentage.toString().padStart(6)}%  ${bar}${flag}`);
  }

  const underRecorded = result.scenarios.filter((s) => s.underRecorded);
  const overRecorded = result.scenarios.filter((s) => s.overRecorded);
  if (underRecorded.length > 0 || overRecorded.length > 0) {
    lines.push('');
    if (underRecorded.length > 0) {
      lines.push(`  ⬇ Under-recorded (${underRecorded.length}): ${underRecorded.map((s) => s.name).join(', ')}`);
    }
    if (overRecorded.length > 0) {
      lines.push(`  ⬆ Over-recorded (${overRecorded.length}): ${overRecorded.map((s) => s.name).join(', ')}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
