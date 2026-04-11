/**
 * Recording comparison radar — compares scenarios across multiple
 * normalized dimensions to produce radar/spider chart data.
 *
 * Dimensions: success rate, volume, freshness, consistency, avg duration.
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** Radar dimension names. */
export const RADAR_DIMENSIONS = [
  'Success Rate',
  'Volume',
  'Freshness',
  'Consistency',
  'Speed',
] as const;

export type RadarDimensionName = (typeof RADAR_DIMENSIONS)[number];

/** A single dimension value for a scenario. */
export interface RadarValue {
  /** Dimension name. */
  readonly dimension: RadarDimensionName;
  /** Normalized score (0-100). */
  readonly score: number;
  /** Raw value before normalization. */
  readonly raw: number;
}

/** A scenario's radar profile. */
export interface RadarProfile {
  /** Scenario name. */
  readonly scenario: string;
  /** Values for each dimension. */
  readonly values: readonly RadarValue[];
  /** Average score across all dimensions. */
  readonly avgScore: number;
}

/** Complete radar chart result. */
export interface RadarResult {
  /** Per-scenario radar profiles. */
  readonly profiles: readonly RadarProfile[];
  /** Dimension names in order. */
  readonly dimensions: readonly RadarDimensionName[];
  /** Best scenario (highest avg score). */
  readonly bestScenario: string;
  /** Worst scenario (lowest avg score). */
  readonly worstScenario: string;
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Whether there is enough data. */
  readonly hasData: boolean;
}

/**
 * Compute radar chart data for scenario comparison.
 */
export function computeRadar(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
): RadarResult {
  if (entries.length === 0) {
    return {
      profiles: [],
      dimensions: [...RADAR_DIMENSIONS],
      bestScenario: '',
      worstScenario: '',
      totalRecordings: 0,
      hasData: false,
    };
  }

  // Group by scenario
  const byScenario = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = byScenario.get(e.scenario) ?? [];
    list.push(e);
    byScenario.set(e.scenario, list);
  }

  // Compute raw values per scenario
  const rawData = new Map<string, { successRate: number; volume: number; freshness: number; consistency: number; speed: number }>();

  for (const [scenario, scenarioEntries] of byScenario) {
    // Success rate
    const okCount = scenarioEntries.filter((e) => e.status === 'ok').length;
    const successRate = (okCount / scenarioEntries.length) * 100;

    // Volume (total count)
    const volume = scenarioEntries.length;

    // Freshness (days since last recording, inverted)
    const lastTs = Math.max(...scenarioEntries.map((e) => new Date(e.timestamp).getTime()));
    const daysSinceLast = (now.getTime() - lastTs) / (24 * 60 * 60 * 1000);
    const freshness = Math.max(0, 30 - daysSinceLast); // 0-30 scale, 30 = recorded today

    // Consistency (coefficient of variation of daily counts, inverted)
    const dailyCounts = new Map<string, number>();
    for (const e of scenarioEntries) {
      const date = e.timestamp.slice(0, 10);
      dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
    }
    const counts = [...dailyCounts.values()];
    let consistency = 1;
    if (counts.length > 1) {
      const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
      const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      consistency = Math.max(0, 1 - cv);
    }

    // Speed (inverse of avg duration — faster is better)
    const avgDur = scenarioEntries.reduce((s, e) => s + e.durationSeconds, 0) / scenarioEntries.length;
    const speed = avgDur > 0 ? 1 / avgDur : 0;

    rawData.set(scenario, { successRate, volume, freshness, consistency, speed });
  }

  // Normalize each dimension to 0-100 across all scenarios
  const scenarios = [...rawData.keys()];
  const normalized = new Map<string, Map<RadarDimensionName, { score: number; raw: number }>>();

  for (const dim of RADAR_DIMENSIONS) {
    const rawKey = dimToKey(dim);
    const values = scenarios.map((s) => rawData.get(s)![rawKey]);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;

    for (const s of scenarios) {
      const raw = rawData.get(s)![rawKey];
      const score = range > 0 ? round2(((raw - min) / range) * 100) : 100;

      if (!normalized.has(s)) normalized.set(s, new Map());
      normalized.get(s)!.set(dim, { score, raw: round2(raw) });
    }
  }

  // Build profiles
  const profiles: RadarProfile[] = scenarios.map((scenario) => {
    const dimMap = normalized.get(scenario)!;
    const values: RadarValue[] = RADAR_DIMENSIONS.map((dim) => ({
      dimension: dim,
      score: dimMap.get(dim)!.score,
      raw: dimMap.get(dim)!.raw,
    }));
    const avgScore = round2(values.reduce((s, v) => s + v.score, 0) / values.length);
    return { scenario, values, avgScore };
  }).sort((a, b) => b.avgScore - a.avgScore);

  return {
    profiles,
    dimensions: [...RADAR_DIMENSIONS],
    bestScenario: profiles[0]?.scenario ?? '',
    worstScenario: profiles[profiles.length - 1]?.scenario ?? '',
    totalRecordings: entries.length,
    hasData: true,
  };
}

function dimToKey(dim: RadarDimensionName): 'successRate' | 'volume' | 'freshness' | 'consistency' | 'speed' {
  switch (dim) {
    case 'Success Rate': return 'successRate';
    case 'Volume': return 'volume';
    case 'Freshness': return 'freshness';
    case 'Consistency': return 'consistency';
    case 'Speed': return 'speed';
  }
}

/**
 * Format radar chart data as a readable report.
 */
export function formatRadar(result: RadarResult): string {
  const lines: string[] = [];

  lines.push('Recording Comparison Radar');
  lines.push('═'.repeat(60));
  lines.push(`  Scenarios: ${result.profiles.length}`);
  lines.push(`  Records:   ${result.totalRecordings}`);

  if (!result.hasData) {
    lines.push('');
    lines.push('  No recording data available.');
    return lines.join('\n');
  }

  if (result.bestScenario) lines.push(`  Best:      ${result.bestScenario}`);
  if (result.worstScenario && result.worstScenario !== result.bestScenario) {
    lines.push(`  Worst:     ${result.worstScenario}`);
  }
  lines.push('');

  // Table
  const dimHeaders = result.dimensions.map((d) => d.slice(0, 8).padStart(8)).join(' ');
  lines.push(`  Scenario          ${dimHeaders}    Avg`);
  lines.push(`  ──────────────── ${result.dimensions.map(() => '────────').join(' ')} ──────`);

  for (const p of result.profiles) {
    const name = p.scenario.padEnd(16).slice(0, 16);
    const scores = p.values.map((v) => v.score.toFixed(0).padStart(8)).join(' ');
    const avg = p.avgScore.toFixed(1).padStart(6);
    lines.push(`  ${name}  ${scores} ${avg}`);
  }
  lines.push('');

  return lines.join('\n');
}
