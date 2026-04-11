/**
 * Recording capacity planner — project future recording throughput,
 * estimate time to reach recording targets, and identify bottlenecks.
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** Scenario throughput profile. */
export interface ScenarioThroughput {
  /** Scenario name. */
  readonly name: string;
  /** Total recordings. */
  readonly totalRecordings: number;
  /** Recordings per day (rolling 7d). */
  readonly perDay7d: number;
  /** Average duration in seconds. */
  readonly avgDuration: number;
  /** Whether this scenario is a bottleneck (lowest throughput). */
  readonly isBottleneck: boolean;
}

/** Time-to-target estimate. */
export interface TargetEstimate {
  /** Target recording count. */
  readonly target: number;
  /** Current count. */
  readonly current: number;
  /** Remaining recordings needed. */
  readonly remaining: number;
  /** Estimated days to reach target at current rate. */
  readonly estimatedDays: number;
  /** Estimated date to reach target. */
  readonly estimatedDate: string;
  /** Whether the target has already been reached. */
  readonly reached: boolean;
}

/** Capacity analysis result. */
export interface CapacityResult {
  /** Overall throughput: recordings per day (rolling 7d). */
  readonly overallPerDay: number;
  /** Overall throughput: recordings per week (rolling 7d). */
  readonly overallPerWeek: number;
  /** Estimated daily recording time in minutes. */
  readonly dailyRecordingMinutes: number;
  /** Per-scenario throughput profiles. */
  readonly scenarios: readonly ScenarioThroughput[];
  /** Bottleneck scenario (lowest throughput). */
  readonly bottleneck: string;
  /** Time-to-target estimates for common milestones. */
  readonly targets: readonly TargetEstimate[];
  /** Total recordings to date. */
  readonly totalRecordings: number;
  /** Active scenarios count. */
  readonly activeScenarios: number;
  /** Capacity utilization: % of time spent recording vs available work hours. */
  readonly capacityUtilization: number;
}

/**
 * Analyze recording capacity and project future throughput.
 */
export function analyzeCapacity(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
  workHoursPerDay = 8,
): CapacityResult {
  if (entries.length === 0) {
    return {
      overallPerDay: 0,
      overallPerWeek: 0,
      dailyRecordingMinutes: 0,
      scenarios: [],
      bottleneck: '',
      targets: buildTargets(0, 0, now),
      totalRecordings: 0,
      activeScenarios: 0,
      capacityUtilization: 0,
    };
  }

  const cutoff7d = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff7d);
  const overallPerDay = round2(recent.length / 7);
  const overallPerWeek = recent.length;

  // Per-scenario throughput
  const scenarioMap = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const arr = scenarioMap.get(e.scenario) ?? [];
    arr.push(e);
    scenarioMap.set(e.scenario, arr);
  }

  const recentMap = new Map<string, HistoryEntry[]>();
  for (const e of recent) {
    const arr = recentMap.get(e.scenario) ?? [];
    arr.push(e);
    recentMap.set(e.scenario, arr);
  }

  const scenarioProfiles: ScenarioThroughput[] = [];
  let minThroughput = Infinity;
  let bottleneckName = '';

  for (const [name, all] of scenarioMap) {
    const recentEntries = recentMap.get(name) ?? [];
    const perDay7d = round2(recentEntries.length / 7);
    const avgDuration = round2(
      all.reduce((s, e) => s + e.durationSeconds, 0) / all.length,
    );

    scenarioProfiles.push({
      name,
      totalRecordings: all.length,
      perDay7d,
      avgDuration,
      isBottleneck: false,
    });

    if (perDay7d < minThroughput && all.length > 0) {
      minThroughput = perDay7d;
      bottleneckName = name;
    }
  }

  // Mark bottleneck
  const scenarios = scenarioProfiles.map((s) => ({
    ...s,
    isBottleneck: s.name === bottleneckName,
  }));

  // Sort by perDay7d ascending (bottleneck first)
  scenarios.sort((a, b) => a.perDay7d - b.perDay7d);

  // Daily recording time estimate
  const avgDurationAll = entries.reduce((s, e) => s + e.durationSeconds, 0) / entries.length;
  const dailyRecordingMinutes = round2((overallPerDay * avgDurationAll) / 60);

  // Capacity utilization: recording minutes / available minutes
  const availableMinutes = workHoursPerDay * 60;
  const capacityUtilization = round2((dailyRecordingMinutes / availableMinutes) * 100);

  // Targets
  const targets = buildTargets(entries.length, overallPerDay, now);

  return {
    overallPerDay,
    overallPerWeek,
    dailyRecordingMinutes,
    scenarios,
    bottleneck: bottleneckName,
    targets,
    totalRecordings: entries.length,
    activeScenarios: scenarioMap.size,
    capacityUtilization,
  };
}

function buildTargets(
  current: number,
  perDay: number,
  now: Date,
): readonly TargetEstimate[] {
  const milestones = [100, 500, 1000, 2500, 5000, 10000];
  const targets: TargetEstimate[] = [];

  for (const target of milestones) {
    if (target <= current * 0.5) continue; // skip milestones already far surpassed
    const remaining = Math.max(0, target - current);
    const reached = remaining === 0;
    const estimatedDays = perDay > 0 ? Math.ceil(remaining / perDay) : Infinity;
    const estimatedDate = perDay > 0 && !reached
      ? new Date(now.getTime() + estimatedDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : reached ? 'reached' : 'never';

    targets.push({ target, current, remaining, estimatedDays, estimatedDate, reached });
  }

  return targets;
}

/**
 * Format capacity analysis report.
 */
export function formatCapacity(result: CapacityResult): string {
  const lines: string[] = [];
  lines.push('Recording Capacity Planner');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Total recordings:     ${result.totalRecordings}`);
  lines.push(`  Active scenarios:     ${result.activeScenarios}`);
  lines.push(`  Current throughput:   ${result.overallPerDay}/day (${result.overallPerWeek}/week)`);
  lines.push(`  Daily recording time: ~${result.dailyRecordingMinutes} min`);
  lines.push(`  Capacity utilization: ${result.capacityUtilization}%`);
  lines.push('');

  if (result.bottleneck) {
    lines.push(`  ⚠ Bottleneck: ${result.bottleneck} (lowest throughput)`);
    lines.push('');
  }

  lines.push('  Per-scenario throughput (7d rolling):');
  for (const s of result.scenarios) {
    const marker = s.isBottleneck ? ' ⚠' : '';
    lines.push(
      `    ${s.name.padEnd(20)} ${s.perDay7d.toString().padStart(6)}/day  ${s.totalRecordings.toString().padStart(5)} total  avg ${s.avgDuration}s${marker}`,
    );
  }

  lines.push('');
  lines.push('  Target projections:');
  for (const t of result.targets) {
    if (t.reached) {
      lines.push(`    ${t.target.toString().padStart(6)} recordings  ✅ reached`);
    } else if (t.estimatedDays === Infinity) {
      lines.push(`    ${t.target.toString().padStart(6)} recordings  ⏳ no recent activity`);
    } else {
      lines.push(
        `    ${t.target.toString().padStart(6)} recordings  ~${t.estimatedDays}d (${t.estimatedDate})  [${t.remaining} remaining]`,
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}
