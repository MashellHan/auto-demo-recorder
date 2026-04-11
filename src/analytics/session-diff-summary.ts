/**
 * Session diff summary — concise comparison of two recording sessions
 * showing which scenarios changed, duration deltas, and pass/fail transitions.
 */

import type { HistoryEntry } from './history.js';

/** Status transition between sessions. */
export type StatusTransition = 'stable-ok' | 'stable-error' | 'fixed' | 'broken' | 'new' | 'removed';

/** Comparison for a single scenario between two sessions. */
export interface ScenarioDiffEntry {
  /** Scenario name. */
  readonly scenario: string;
  /** Status transition. */
  readonly transition: StatusTransition;
  /** Duration in session A (undefined if new). */
  readonly durationA?: number;
  /** Duration in session B (undefined if removed). */
  readonly durationB?: number;
  /** Duration delta (positive = slower). */
  readonly durationDelta?: number;
  /** Duration change percentage. */
  readonly durationPct?: number;
  /** Bug count in session A. */
  readonly bugsA?: number;
  /** Bug count in session B. */
  readonly bugsB?: number;
}

/** Session diff summary result. */
export interface SessionDiffSummary {
  /** Session A identifier. */
  readonly sessionA: string;
  /** Session B identifier. */
  readonly sessionB: string;
  /** Per-scenario comparisons. */
  readonly diffs: readonly ScenarioDiffEntry[];
  /** Summary counts. */
  readonly summary: {
    readonly total: number;
    readonly stableOk: number;
    readonly stableError: number;
    readonly fixed: number;
    readonly broken: number;
    readonly newScenarios: number;
    readonly removed: number;
    readonly avgDurationDelta: number;
  };
}

/**
 * Compare two recording sessions by their history entries.
 */
export function diffSessionEntries(
  entriesA: readonly HistoryEntry[],
  entriesB: readonly HistoryEntry[],
  sessionA: string,
  sessionB: string,
): SessionDiffSummary {
  const mapA = new Map<string, HistoryEntry>();
  const mapB = new Map<string, HistoryEntry>();

  for (const e of entriesA) mapA.set(e.scenario, e);
  for (const e of entriesB) mapB.set(e.scenario, e);

  const allScenarios = new Set([...mapA.keys(), ...mapB.keys()]);
  const diffs: ScenarioDiffEntry[] = [];

  for (const scenario of allScenarios) {
    const a = mapA.get(scenario);
    const b = mapB.get(scenario);

    if (!a && b) {
      diffs.push({
        scenario,
        transition: 'new',
        durationB: b.durationSeconds,
        bugsB: b.bugsFound,
      });
    } else if (a && !b) {
      diffs.push({
        scenario,
        transition: 'removed',
        durationA: a.durationSeconds,
        bugsA: a.bugsFound,
      });
    } else if (a && b) {
      const transition = classifyTransition(a.status, b.status);
      const durationDelta = b.durationSeconds - a.durationSeconds;
      const durationPct = a.durationSeconds > 0
        ? Math.round((durationDelta / a.durationSeconds) * 1000) / 10
        : 0;

      diffs.push({
        scenario,
        transition,
        durationA: a.durationSeconds,
        durationB: b.durationSeconds,
        durationDelta: Math.round(durationDelta * 100) / 100,
        durationPct,
        bugsA: a.bugsFound,
        bugsB: b.bugsFound,
      });
    }
  }

  diffs.sort((a, b) => {
    const order: Record<StatusTransition, number> = {
      'broken': 0,
      'fixed': 1,
      'new': 2,
      'removed': 3,
      'stable-error': 4,
      'stable-ok': 5,
    };
    return (order[a.transition] ?? 5) - (order[b.transition] ?? 5);
  });

  const durDeltas = diffs
    .filter((d) => d.durationDelta !== undefined)
    .map((d) => d.durationDelta!);
  const avgDurationDelta = durDeltas.length > 0
    ? Math.round((durDeltas.reduce((s, v) => s + v, 0) / durDeltas.length) * 100) / 100
    : 0;

  return {
    sessionA,
    sessionB,
    diffs,
    summary: {
      total: diffs.length,
      stableOk: diffs.filter((d) => d.transition === 'stable-ok').length,
      stableError: diffs.filter((d) => d.transition === 'stable-error').length,
      fixed: diffs.filter((d) => d.transition === 'fixed').length,
      broken: diffs.filter((d) => d.transition === 'broken').length,
      newScenarios: diffs.filter((d) => d.transition === 'new').length,
      removed: diffs.filter((d) => d.transition === 'removed').length,
      avgDurationDelta,
    },
  };
}

function classifyTransition(statusA: string, statusB: string): StatusTransition {
  if (statusA === 'ok' && statusB === 'ok') return 'stable-ok';
  if (statusA !== 'ok' && statusB !== 'ok') return 'stable-error';
  if (statusA !== 'ok' && statusB === 'ok') return 'fixed';
  return 'broken';
}

/**
 * Format session diff summary as a human-readable report.
 */
export function formatSessionDiffSummary(result: SessionDiffSummary): string {
  const lines: string[] = [];
  lines.push('Session Diff Summary');
  lines.push('═'.repeat(60));
  lines.push(`  ${result.sessionA} → ${result.sessionB}`);
  lines.push('');

  if (result.diffs.length === 0) {
    lines.push('  No scenarios found in either session.');
    return lines.join('\n');
  }

  const icons: Record<StatusTransition, string> = {
    'broken': '🔴',
    'fixed': '🟢',
    'new': '🆕',
    'removed': '🗑️',
    'stable-error': '⚠️',
    'stable-ok': '✓',
  };

  for (const d of result.diffs) {
    const icon = icons[d.transition] ?? '?';
    let detail = d.transition;
    if (d.durationDelta !== undefined) {
      const sign = d.durationDelta >= 0 ? '+' : '';
      detail += ` (${sign}${d.durationDelta}s / ${sign}${d.durationPct}%)`;
    }
    lines.push(`  ${icon} ${d.scenario.padEnd(25)} ${detail}`);
  }

  lines.push('');
  const s = result.summary;
  const parts: string[] = [];
  if (s.stableOk > 0) parts.push(`${s.stableOk} stable`);
  if (s.broken > 0) parts.push(`${s.broken} broken`);
  if (s.fixed > 0) parts.push(`${s.fixed} fixed`);
  if (s.newScenarios > 0) parts.push(`${s.newScenarios} new`);
  if (s.removed > 0) parts.push(`${s.removed} removed`);
  if (s.stableError > 0) parts.push(`${s.stableError} still-failing`);

  lines.push(`  Summary: ${parts.join(', ')} (${s.total} scenarios)`);
  if (s.avgDurationDelta !== 0) {
    const sign = s.avgDurationDelta >= 0 ? '+' : '';
    lines.push(`  Avg duration change: ${sign}${s.avgDurationDelta}s`);
  }

  return lines.join('\n');
}
