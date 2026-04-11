/**
 * Recording summary digest — generates a concise daily or weekly digest
 * of recording activity with highlights, concerns, and key metrics.
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** Digest time period. */
export type DigestPeriod = 'daily' | 'weekly';

/** A concern or highlight item. */
export interface DigestItem {
  /** Icon/emoji for the item. */
  readonly icon: string;
  /** Short label. */
  readonly label: string;
  /** Description. */
  readonly description: string;
}

/** Summary digest result. */
export interface DigestResult {
  /** Digest period. */
  readonly period: DigestPeriod;
  /** Period start date (ISO). */
  readonly startDate: string;
  /** Period end date (ISO). */
  readonly endDate: string;
  /** Total recordings in period. */
  readonly totalRecordings: number;
  /** Successful recordings. */
  readonly successCount: number;
  /** Failed recordings. */
  readonly failureCount: number;
  /** Success rate percentage. */
  readonly successRate: number;
  /** Unique scenarios recorded. */
  readonly scenariosRecorded: number;
  /** Total recording time in seconds. */
  readonly totalDuration: number;
  /** Average recording duration in seconds. */
  readonly avgDuration: number;
  /** Most active scenario. */
  readonly mostActive: string;
  /** Least active scenario. */
  readonly leastActive: string;
  /** Highlights (positive items). */
  readonly highlights: readonly DigestItem[];
  /** Concerns (negative items). */
  readonly concerns: readonly DigestItem[];
  /** Whether the period had any recordings. */
  readonly hasData: boolean;
}

/**
 * Generate a recording summary digest for a given period.
 */
export function generateDigest(
  entries: readonly HistoryEntry[],
  period: DigestPeriod = 'daily',
  now: Date = new Date(),
): DigestResult {
  const msPerDay = 24 * 60 * 60 * 1000;
  const periodDays = period === 'daily' ? 1 : 7;
  const periodMs = periodDays * msPerDay;
  const endDate = now;
  const startDate = new Date(now.getTime() - periodMs);

  const periodEntries = entries.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t > startDate.getTime() && t <= endDate.getTime();
  });

  if (periodEntries.length === 0) {
    return {
      period,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      totalRecordings: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      scenariosRecorded: 0,
      totalDuration: 0,
      avgDuration: 0,
      mostActive: '',
      leastActive: '',
      highlights: [],
      concerns: [{ icon: '📭', label: 'No activity', description: `No recordings in the last ${periodDays} day(s)` }],
      hasData: false,
    };
  }

  const successCount = periodEntries.filter((e) => e.status === 'ok').length;
  const failureCount = periodEntries.length - successCount;
  const successRate = round2((successCount / periodEntries.length) * 100);
  const totalDuration = periodEntries.reduce((s, e) => s + e.durationSeconds, 0);
  const avgDuration = round2(totalDuration / periodEntries.length);

  // Scenario counts
  const scenarioCounts = new Map<string, number>();
  for (const e of periodEntries) {
    scenarioCounts.set(e.scenario, (scenarioCounts.get(e.scenario) ?? 0) + 1);
  }

  const sorted = [...scenarioCounts.entries()].sort((a, b) => b[1] - a[1]);
  const mostActive = sorted[0]?.[0] ?? '';
  const leastActive = sorted[sorted.length - 1]?.[0] ?? '';

  // Build highlights and concerns
  const highlights: DigestItem[] = [];
  const concerns: DigestItem[] = [];

  // Highlights
  if (successRate === 100) {
    highlights.push({ icon: '🏆', label: 'Perfect run', description: `All ${periodEntries.length} recordings succeeded` });
  } else if (successRate >= 95) {
    highlights.push({ icon: '✅', label: 'High success', description: `${successRate}% success rate` });
  }

  if (periodEntries.length >= (period === 'daily' ? 10 : 50)) {
    highlights.push({ icon: '🚀', label: 'High volume', description: `${periodEntries.length} recordings in ${periodDays}d` });
  }

  if (scenarioCounts.size >= 3) {
    highlights.push({ icon: '📊', label: 'Good coverage', description: `${scenarioCounts.size} different scenarios recorded` });
  }

  // Compare to prior period
  const priorStart = new Date(startDate.getTime() - periodMs);
  const priorEntries = entries.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t > priorStart.getTime() && t <= startDate.getTime();
  });

  if (priorEntries.length > 0 && periodEntries.length > priorEntries.length * 1.2) {
    const growthPct = round2(((periodEntries.length - priorEntries.length) / priorEntries.length) * 100);
    highlights.push({ icon: '📈', label: 'Growing', description: `${growthPct}% more recordings than prior period` });
  }

  // Concerns
  if (failureCount > 0) {
    concerns.push({ icon: '❌', label: 'Failures', description: `${failureCount} recording(s) failed (${round2((failureCount / periodEntries.length) * 100)}%)` });
  }

  if (successRate < 80 && successRate > 0) {
    concerns.push({ icon: '⚠️', label: 'Low success rate', description: `Only ${successRate}% success rate` });
  }

  if (priorEntries.length > 0 && periodEntries.length < priorEntries.length * 0.5) {
    concerns.push({ icon: '📉', label: 'Volume drop', description: `${round2(((priorEntries.length - periodEntries.length) / priorEntries.length) * 100)}% fewer recordings than prior period` });
  }

  const totalBugs = periodEntries.reduce((s, e) => s + (e.bugsFound ?? 0), 0);
  if (totalBugs > 0) {
    concerns.push({ icon: '🐛', label: 'Bugs found', description: `${totalBugs} bug(s) detected during recordings` });
  }

  return {
    period,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    totalRecordings: periodEntries.length,
    successCount,
    failureCount,
    successRate,
    scenariosRecorded: scenarioCounts.size,
    totalDuration,
    avgDuration,
    mostActive,
    leastActive,
    highlights,
    concerns,
    hasData: true,
  };
}

/**
 * Format digest as a readable report.
 */
export function formatDigest(result: DigestResult): string {
  const lines: string[] = [];
  const periodLabel = result.period === 'daily' ? 'Daily' : 'Weekly';

  lines.push(`${periodLabel} Recording Digest`);
  lines.push('═'.repeat(60));
  lines.push(`  Period: ${result.startDate} → ${result.endDate}`);
  lines.push('');

  if (!result.hasData) {
    for (const c of result.concerns) {
      lines.push(`  ${c.icon} ${c.label}: ${c.description}`);
    }
    return lines.join('\n');
  }

  lines.push(`  📊 Recordings:   ${result.totalRecordings} (${result.successCount} ok, ${result.failureCount} failed)`);
  lines.push(`  ✅ Success rate:  ${result.successRate}%`);
  lines.push(`  ⏱  Avg duration: ${result.avgDuration}s`);
  lines.push(`  🎯 Scenarios:    ${result.scenariosRecorded}`);
  lines.push(`  🏅 Most active:  ${result.mostActive}`);
  if (result.mostActive !== result.leastActive) {
    lines.push(`  📉 Least active: ${result.leastActive}`);
  }
  lines.push('');

  if (result.highlights.length > 0) {
    lines.push('  Highlights:');
    for (const h of result.highlights) {
      lines.push(`    ${h.icon} ${h.label}: ${h.description}`);
    }
    lines.push('');
  }

  if (result.concerns.length > 0) {
    lines.push('  Concerns:');
    for (const c of result.concerns) {
      lines.push(`    ${c.icon} ${c.label}: ${c.description}`);
    }
    lines.push('');
  }

  if (result.highlights.length === 0 && result.concerns.length === 0) {
    lines.push('  No highlights or concerns.');
    lines.push('');
  }

  return lines.join('\n');
}
