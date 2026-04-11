/**
 * Performance benchmarks — compute percentile-based duration metrics
 * from recording history: p50, p95, p99, fastest/slowest scenarios,
 * and improvement rate over time.
 */

import type { HistoryEntry } from './history.js';

/** Percentile benchmark for a single scenario. */
export interface ScenarioBenchmark {
  /** Scenario name. */
  readonly scenario: string;
  /** Number of recordings analyzed. */
  readonly count: number;
  /** Minimum duration. */
  readonly min: number;
  /** Maximum duration. */
  readonly max: number;
  /** Mean duration. */
  readonly mean: number;
  /** Median duration (p50). */
  readonly p50: number;
  /** 95th percentile duration. */
  readonly p95: number;
  /** 99th percentile duration. */
  readonly p99: number;
  /** Standard deviation. */
  readonly stddev: number;
  /** Improvement rate: negative = getting faster over time. */
  readonly improvementRate: number;
}

/** Overall benchmark result. */
export interface BenchmarkResult {
  /** Per-scenario benchmarks. */
  readonly scenarios: readonly ScenarioBenchmark[];
  /** Global aggregate. */
  readonly global: {
    readonly totalRecordings: number;
    readonly avgDuration: number;
    readonly p50: number;
    readonly p95: number;
    readonly p99: number;
    readonly fastestScenario: string;
    readonly slowestScenario: string;
  };
}

/**
 * Compute performance benchmarks from recording history.
 */
export function computeBenchmarks(entries: readonly HistoryEntry[]): BenchmarkResult {
  // Group by scenario
  const groups = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.scenario) ?? [];
    list.push(e);
    groups.set(e.scenario, list);
  }

  const scenarios: ScenarioBenchmark[] = [];
  for (const [scenario, group] of groups) {
    const durations = group.map((e) => e.durationSeconds).sort((a, b) => a - b);
    const mean = durations.reduce((s, v) => s + v, 0) / durations.length;
    const variance = durations.reduce((s, v) => s + (v - mean) ** 2, 0) / durations.length;
    const stddev = Math.sqrt(variance);

    scenarios.push({
      scenario,
      count: durations.length,
      min: round2(durations[0]),
      max: round2(durations[durations.length - 1]),
      mean: round2(mean),
      p50: round2(percentile(durations, 50)),
      p95: round2(percentile(durations, 95)),
      p99: round2(percentile(durations, 99)),
      stddev: round2(stddev),
      improvementRate: computeImprovementRate(group),
    });
  }

  scenarios.sort((a, b) => a.scenario.localeCompare(b.scenario));

  // Global aggregates
  const allDurations = entries.map((e) => e.durationSeconds).sort((a, b) => a - b);
  const avgDuration = allDurations.length > 0
    ? allDurations.reduce((s, v) => s + v, 0) / allDurations.length
    : 0;

  const fastestScenario = scenarios.length > 0
    ? scenarios.reduce((best, s) => s.mean < best.mean ? s : best).scenario
    : '-';
  const slowestScenario = scenarios.length > 0
    ? scenarios.reduce((worst, s) => s.mean > worst.mean ? s : worst).scenario
    : '-';

  return {
    scenarios,
    global: {
      totalRecordings: entries.length,
      avgDuration: round2(avgDuration),
      p50: allDurations.length > 0 ? round2(percentile(allDurations, 50)) : 0,
      p95: allDurations.length > 0 ? round2(percentile(allDurations, 95)) : 0,
      p99: allDurations.length > 0 ? round2(percentile(allDurations, 99)) : 0,
      fastestScenario,
      slowestScenario,
    },
  };
}

function percentile(sorted: readonly number[], pct: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const frac = index - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Compute improvement rate: compare first half vs second half durations.
 * Returns percentage change (negative = faster/better).
 */
function computeImprovementRate(entries: readonly HistoryEntry[]): number {
  if (entries.length < 4) return 0;

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const avgFirst = firstHalf.reduce((s, e) => s + e.durationSeconds, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, e) => s + e.durationSeconds, 0) / secondHalf.length;

  if (avgFirst === 0) return 0;
  return round2(((avgSecond - avgFirst) / avgFirst) * 100);
}

/**
 * Format benchmark results as a human-readable report.
 */
export function formatBenchmarks(result: BenchmarkResult): string {
  const lines: string[] = [];
  lines.push('Performance Benchmarks');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.global.totalRecordings === 0) {
    lines.push('  No recordings to benchmark.');
    return lines.join('\n');
  }

  lines.push('  Global:');
  lines.push(`    Total recordings: ${result.global.totalRecordings}`);
  lines.push(`    Average:          ${result.global.avgDuration}s`);
  lines.push(`    p50 (median):     ${result.global.p50}s`);
  lines.push(`    p95:              ${result.global.p95}s`);
  lines.push(`    p99:              ${result.global.p99}s`);
  lines.push(`    Fastest scenario: ${result.global.fastestScenario}`);
  lines.push(`    Slowest scenario: ${result.global.slowestScenario}`);
  lines.push('');

  lines.push('  Per-Scenario:');
  lines.push(`    ${'Scenario'.padEnd(22)} ${'Count'.padStart(6)} ${'Mean'.padStart(8)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'Trend'.padStart(8)}`);
  lines.push('    ' + '─'.repeat(70));

  for (const s of result.scenarios) {
    const trend = s.improvementRate === 0
      ? '   —'
      : s.improvementRate < 0
        ? ` ↓${Math.abs(s.improvementRate)}%`
        : ` ↑${s.improvementRate}%`;
    lines.push(`    ${s.scenario.padEnd(22)} ${s.count.toString().padStart(6)} ${(s.mean + 's').padStart(8)} ${(s.p50 + 's').padStart(8)} ${(s.p95 + 's').padStart(8)} ${(s.p99 + 's').padStart(8)} ${trend.padStart(8)}`);
  }

  lines.push('');
  return lines.join('\n');
}
