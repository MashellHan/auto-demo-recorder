/**
 * Recording Pareto analysis — applies the 80/20 rule to identify
 * which scenarios are responsible for the majority of failures,
 * bugs, and recording duration.
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** Category for Pareto analysis. */
export type ParetoCategory = 'failures' | 'bugs' | 'duration';

/** A single item in the Pareto ranking. */
export interface ParetoItem {
  /** Scenario name. */
  readonly scenario: string;
  /** Raw count/value for this category. */
  readonly value: number;
  /** Percentage of total. */
  readonly percentage: number;
  /** Cumulative percentage. */
  readonly cumulative: number;
  /** Whether this item is in the "vital few" (cumulative ≤ 80%). */
  readonly isVitalFew: boolean;
}

/** Complete Pareto analysis for one category. */
export interface ParetoAnalysis {
  /** Category analyzed. */
  readonly category: ParetoCategory;
  /** Ranked items (descending by value). */
  readonly items: readonly ParetoItem[];
  /** Total value across all items. */
  readonly total: number;
  /** Number of scenarios in the "vital few". */
  readonly vitalFewCount: number;
  /** Percentage of scenarios that are "vital few". */
  readonly vitalFewPercentage: number;
  /** Label for the category. */
  readonly label: string;
}

/** Complete Pareto result across all categories. */
export interface ParetoResult {
  /** Per-category Pareto analysis. */
  readonly analyses: readonly ParetoAnalysis[];
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Total unique scenarios. */
  readonly totalScenarios: number;
  /** Whether there is enough data. */
  readonly hasData: boolean;
}

/**
 * Run Pareto analysis across failure, bug, and duration categories.
 */
export function analyzePareto(
  entries: readonly HistoryEntry[],
): ParetoResult {
  if (entries.length === 0) {
    return {
      analyses: [],
      totalRecordings: 0,
      totalScenarios: 0,
      hasData: false,
    };
  }

  const analyses: ParetoAnalysis[] = [];

  // Category 1: Failures
  const failureMap = new Map<string, number>();
  for (const e of entries) {
    if (e.status !== 'ok') {
      failureMap.set(e.scenario, (failureMap.get(e.scenario) ?? 0) + 1);
    }
  }
  analyses.push(buildPareto('failures', 'Failures', failureMap));

  // Category 2: Bugs
  const bugMap = new Map<string, number>();
  for (const e of entries) {
    const bugs = e.bugsFound ?? 0;
    if (bugs > 0) {
      bugMap.set(e.scenario, (bugMap.get(e.scenario) ?? 0) + bugs);
    }
  }
  analyses.push(buildPareto('bugs', 'Bugs Found', bugMap));

  // Category 3: Duration (total recording time)
  const durationMap = new Map<string, number>();
  for (const e of entries) {
    durationMap.set(e.scenario, (durationMap.get(e.scenario) ?? 0) + e.durationSeconds);
  }
  analyses.push(buildPareto('duration', 'Total Duration (s)', durationMap));

  const uniqueScenarios = new Set(entries.map((e) => e.scenario));

  return {
    analyses,
    totalRecordings: entries.length,
    totalScenarios: uniqueScenarios.size,
    hasData: true,
  };
}

/**
 * Build Pareto ranking for a single category.
 */
function buildPareto(
  category: ParetoCategory,
  label: string,
  data: Map<string, number>,
): ParetoAnalysis {
  const total = [...data.values()].reduce((s, v) => s + v, 0);

  if (total === 0) {
    return {
      category,
      items: [],
      total: 0,
      vitalFewCount: 0,
      vitalFewPercentage: 0,
      label,
    };
  }

  // Sort descending by value
  const sorted = [...data.entries()].sort((a, b) => b[1] - a[1]);

  let cumulative = 0;
  let vitalFewCount = 0;
  const items: ParetoItem[] = sorted.map(([scenario, value]) => {
    const percentage = round2((value / total) * 100);
    cumulative += percentage;
    const isVitalFew = cumulative <= 80 || vitalFewCount === 0;
    if (isVitalFew) vitalFewCount++;
    return {
      scenario,
      value,
      percentage,
      cumulative: round2(cumulative),
      isVitalFew,
    };
  });

  return {
    category,
    items,
    total,
    vitalFewCount,
    vitalFewPercentage: data.size > 0 ? round2((vitalFewCount / data.size) * 100) : 0,
    label,
  };
}

/** Format a numeric value, rounding floats to 2 decimal places. */
function formatValue(n: number): string {
  return Number.isInteger(n) ? n.toString() : round2(n).toString();
}

/**
 * Format Pareto analysis as a readable report.
 */
export function formatPareto(result: ParetoResult): string {
  const lines: string[] = [];

  lines.push('Recording Pareto Analysis (80/20 Rule)');
  lines.push('═'.repeat(60));
  lines.push(`  Recordings: ${result.totalRecordings}`);
  lines.push(`  Scenarios:  ${result.totalScenarios}`);

  if (!result.hasData) {
    lines.push('');
    lines.push('  No recording data available.');
    return lines.join('\n');
  }

  lines.push('');

  for (const analysis of result.analyses) {
    lines.push(`  ${analysis.label}:`);

    if (analysis.items.length === 0) {
      lines.push('    (none)');
      lines.push('');
      continue;
    }

    lines.push(`    Total: ${formatValue(analysis.total)}`);
    lines.push(`    Vital few: ${analysis.vitalFewCount}/${analysis.items.length} scenarios (${analysis.vitalFewPercentage}%)`);
    lines.push('');
    lines.push('    Scenario          Value    %   Cumul  Status');
    lines.push('    ──────────────── ─────── ───── ─────── ──────');

    for (const item of analysis.items) {
      const name = item.scenario.padEnd(16).slice(0, 16);
      const value = formatValue(item.value).padStart(7);
      const pct = `${item.percentage}%`.padStart(5);
      const cum = `${item.cumulative}%`.padStart(6);
      const status = item.isVitalFew ? '🔴 vital' : '🟢 trivial';
      lines.push(`    ${name} ${value} ${pct} ${cum}  ${status}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
