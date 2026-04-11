/**
 * Recording funnel analysis — models the recording pipeline as a funnel
 * and computes conversion rates, drop-off points, and throughput metrics.
 *
 * Funnel stages: Total → Successful → Low-bug → Fast (below avg duration)
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** A single funnel stage. */
export interface FunnelStage {
  /** Stage name. */
  readonly name: string;
  /** Number of recordings at this stage. */
  readonly count: number;
  /** Percentage of total (from stage 1). */
  readonly percentOfTotal: number;
  /** Conversion rate from previous stage (100% for first stage). */
  readonly conversionRate: number;
  /** Drop-off count from previous stage. */
  readonly dropOff: number;
}

/** Per-scenario funnel breakdown. */
export interface ScenarioFunnel {
  /** Scenario name. */
  readonly scenario: string;
  /** Total recordings. */
  readonly total: number;
  /** Successful recordings. */
  readonly successful: number;
  /** Success rate (0-100). */
  readonly successRate: number;
  /** Recordings with zero bugs. */
  readonly bugFree: number;
  /** Bug-free rate of successful recordings (0-100). */
  readonly bugFreeRate: number;
}

/** Complete funnel analysis result. */
export interface FunnelResult {
  /** Funnel stages in order. */
  readonly stages: readonly FunnelStage[];
  /** Per-scenario breakdown. */
  readonly scenarioFunnels: readonly ScenarioFunnel[];
  /** Overall throughput (recordings that pass all stages). */
  readonly throughput: number;
  /** Overall throughput rate (0-100). */
  readonly throughputRate: number;
  /** Biggest drop-off stage name. */
  readonly biggestDropOff: string;
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Whether there is enough data. */
  readonly hasData: boolean;
}

/**
 * Analyze recording funnel.
 */
export function analyzeFunnel(
  entries: readonly HistoryEntry[],
): FunnelResult {
  if (entries.length === 0) {
    return {
      stages: [],
      scenarioFunnels: [],
      throughput: 0,
      throughputRate: 0,
      biggestDropOff: '',
      totalRecordings: 0,
      hasData: false,
    };
  }

  const total = entries.length;
  const successful = entries.filter((e) => e.status === 'ok');
  const bugFree = successful.filter((e) => (e.bugsFound ?? 0) === 0);

  // "Fast" = below average duration of successful recordings
  const avgDuration = successful.length > 0
    ? successful.reduce((s, e) => s + e.durationSeconds, 0) / successful.length
    : 0;
  const fast = bugFree.filter((e) => e.durationSeconds <= avgDuration);

  // Build funnel stages
  const stages: FunnelStage[] = [];
  const stageDefs: Array<{ name: string; count: number }> = [
    { name: 'Total', count: total },
    { name: 'Successful', count: successful.length },
    { name: 'Bug-free', count: bugFree.length },
    { name: 'Fast', count: fast.length },
  ];

  for (let i = 0; i < stageDefs.length; i++) {
    const def = stageDefs[i]!;
    const prev = i > 0 ? stageDefs[i - 1]!.count : def.count;
    stages.push({
      name: def.name,
      count: def.count,
      percentOfTotal: round2((def.count / total) * 100),
      conversionRate: prev > 0 ? round2((def.count / prev) * 100) : 0,
      dropOff: i > 0 ? prev - def.count : 0,
    });
  }

  // Find biggest drop-off
  let maxDropOff = 0;
  let biggestDropOff = '';
  for (const s of stages) {
    if (s.dropOff > maxDropOff) {
      maxDropOff = s.dropOff;
      biggestDropOff = s.name;
    }
  }

  // Per-scenario breakdown
  const scenarioMap = new Map<string, { total: number; ok: number; bugFree: number }>();
  for (const e of entries) {
    const cur = scenarioMap.get(e.scenario) ?? { total: 0, ok: 0, bugFree: 0 };
    cur.total += 1;
    if (e.status === 'ok') {
      cur.ok += 1;
      if ((e.bugsFound ?? 0) === 0) cur.bugFree += 1;
    }
    scenarioMap.set(e.scenario, cur);
  }

  const scenarioFunnels: ScenarioFunnel[] = [...scenarioMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([scenario, data]) => ({
      scenario,
      total: data.total,
      successful: data.ok,
      successRate: round2((data.ok / data.total) * 100),
      bugFree: data.bugFree,
      bugFreeRate: data.ok > 0 ? round2((data.bugFree / data.ok) * 100) : 0,
    }));

  return {
    stages,
    scenarioFunnels,
    throughput: fast.length,
    throughputRate: round2((fast.length / total) * 100),
    biggestDropOff,
    totalRecordings: total,
    hasData: true,
  };
}

/**
 * Format funnel analysis as a readable report.
 */
export function formatFunnel(result: FunnelResult): string {
  const lines: string[] = [];

  lines.push('Recording Funnel Analysis');
  lines.push('═'.repeat(60));
  lines.push(`  Total recordings: ${result.totalRecordings}`);

  if (!result.hasData) {
    lines.push('');
    lines.push('  No recording data available.');
    return lines.join('\n');
  }

  lines.push(`  Throughput:       ${result.throughput} (${result.throughputRate}%)`);
  if (result.biggestDropOff) {
    lines.push(`  Biggest drop-off: ${result.biggestDropOff}`);
  }
  lines.push('');

  // Funnel visualization
  lines.push('  Funnel:');
  const maxWidth = 40;
  for (const stage of result.stages) {
    const barWidth = Math.max(1, Math.round((stage.count / result.totalRecordings) * maxWidth));
    const bar = '█'.repeat(barWidth);
    const pct = `${stage.percentOfTotal}%`;
    const conv = stage.dropOff > 0 ? ` (-${stage.dropOff}, ${stage.conversionRate}% conv)` : '';
    lines.push(`    ${stage.name.padEnd(12)} ${bar} ${stage.count} (${pct})${conv}`);
  }
  lines.push('');

  // Per-scenario table
  if (result.scenarioFunnels.length > 0) {
    lines.push('  Per-scenario:');
    lines.push('    Scenario         Total   Ok  Success  BugFree  BF Rate');
    lines.push('    ──────────────── ────── ──── ──────── ──────── ────────');
    for (const sf of result.scenarioFunnels) {
      const name = sf.scenario.padEnd(16).slice(0, 16);
      const total = sf.total.toString().padStart(6);
      const ok = sf.successful.toString().padStart(4);
      const rate = `${sf.successRate}%`.padStart(7);
      const bf = sf.bugFree.toString().padStart(8);
      const bfRate = `${sf.bugFreeRate}%`.padStart(7);
      lines.push(`    ${name} ${total} ${ok} ${rate} ${bf} ${bfRate}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
