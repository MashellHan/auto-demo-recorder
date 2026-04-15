/**
 * Recording retention policy — evaluate and enforce retention rules
 * based on recording age, count, and disk usage patterns.
 *
 * Integrates with the existing cleanup-policy and prune modules to
 * provide a unified retention strategy.
 */

import type { HistoryEntry } from './history.js';

/** Retention policy definition. */
export interface RetentionPolicy {
  /** Maximum age in days before recordings expire (default: 30). */
  readonly maxAgeDays?: number;
  /** Maximum total recordings to keep (default: 1000). */
  readonly maxCount?: number;
  /** Maximum recordings per scenario (default: 100). */
  readonly maxPerScenario?: number;
  /** Keep at least N recent recordings per scenario (default: 5). */
  readonly minPerScenario?: number;
  /** Whether to keep failed recordings regardless of age (default: true). */
  readonly keepFailed?: boolean;
}

/** A recording flagged for removal by the retention policy. */
export interface RetentionCandidate {
  /** The history entry. */
  readonly entry: HistoryEntry;
  /** Reason for removal. */
  readonly reason: 'age' | 'count' | 'per_scenario_count';
  /** Human-readable explanation. */
  readonly explanation: string;
}

/** Retention policy evaluation result. */
export interface RetentionResult {
  /** Recordings flagged for removal. */
  readonly candidates: readonly RetentionCandidate[];
  /** Recordings that will be kept. */
  readonly keepCount: number;
  /** Total recordings analyzed. */
  readonly totalCount: number;
  /** Policy that was applied. */
  readonly policy: Required<RetentionPolicy>;
  /** Per-scenario retention summary. */
  readonly scenarioSummary: readonly ScenarioRetention[];
}

/** Per-scenario retention summary. */
export interface ScenarioRetention {
  /** Scenario name. */
  readonly scenario: string;
  /** Total recordings for this scenario. */
  readonly total: number;
  /** Recordings to keep. */
  readonly keep: number;
  /** Recordings to remove. */
  readonly remove: number;
}

const DEFAULTS: Required<RetentionPolicy> = {
  maxAgeDays: 30,
  maxCount: 1000,
  maxPerScenario: 100,
  minPerScenario: 5,
  keepFailed: true,
};

/**
 * Evaluate retention policy against recording history.
 * Returns candidates for removal without actually deleting anything.
 */
export function evaluateRetention(
  entries: readonly HistoryEntry[],
  policy: RetentionPolicy = {},
): RetentionResult {
  // Strip undefined values so they don't override DEFAULTS via spread
  const cleaned = Object.fromEntries(
    Object.entries(policy).filter(([, v]) => v !== undefined),
  );
  const p = { ...DEFAULTS, ...cleaned } as Required<RetentionPolicy>;

  // Validate numeric policy values to prevent accidental data loss
  if (p.maxAgeDays <= 0) {
    throw new Error('maxAgeDays must be a positive number (got ' + p.maxAgeDays + ')');
  }
  if (p.maxCount <= 0) {
    throw new Error('maxCount must be a positive number (got ' + p.maxCount + ')');
  }
  if (p.maxPerScenario <= 0) {
    throw new Error('maxPerScenario must be a positive number (got ' + p.maxPerScenario + ')');
  }

  const now = Date.now();
  const maxAgeMs = p.maxAgeDays * 24 * 60 * 60 * 1000;

  // Sort entries newest-first for retention logic
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const removeSet = new Set<number>();
  const reasons = new Map<number, RetentionCandidate>();

  // Phase 1: Age-based removal
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const age = now - new Date(entry.timestamp).getTime();
    if (age > maxAgeMs) {
      if (p.keepFailed && entry.status !== 'ok') {
        continue; // Keep failed recordings
      }
      removeSet.add(i);
      reasons.set(i, {
        entry,
        reason: 'age',
        explanation: `Older than ${p.maxAgeDays} days`,
      });
    }
  }

  // Phase 2: Global count-based removal (oldest first after age filter)
  if (sorted.filter((_, i) => !removeSet.has(i)).length > p.maxCount) {
    // Build list of remaining entries, oldest-first
    const remainingOldestFirst = sorted
      .map((entry, i) => ({ entry, i }))
      .filter(({ i }) => !removeSet.has(i))
      .reverse();

    for (const { entry, i } of remainingOldestFirst) {
      if (sorted.filter((_, idx) => !removeSet.has(idx)).length <= p.maxCount) break;
      removeSet.add(i);
      reasons.set(i, {
        entry,
        reason: 'count',
        explanation: `Exceeds max count of ${p.maxCount}`,
      });
    }
  }

  // Phase 3: Per-scenario count-based removal
  const scenarioEntries = new Map<string, Array<{ entry: HistoryEntry; index: number }>>();
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const group = scenarioEntries.get(entry.scenario) ?? [];
    group.push({ entry, index: i });
    scenarioEntries.set(entry.scenario, group);
  }

  for (const [, group] of scenarioEntries) {
    // Count how many are still kept in this group
    const keptIndices = group.filter((g) => !removeSet.has(g.index));
    // When minPerScenario >= maxPerScenario, the floor takes precedence — skip removal
    if (keptIndices.length > p.maxPerScenario && p.maxPerScenario > p.minPerScenario) {
      const canRemove = keptIndices.length - p.maxPerScenario;
      // Remove from the oldest end
      const oldestFirst = [...keptIndices].reverse();
      for (let j = 0; j < canRemove && j < oldestFirst.length; j++) {
        const { entry, index } = oldestFirst[j];
        removeSet.add(index);
        reasons.set(index, {
          entry,
          reason: 'per_scenario_count',
          explanation: `Exceeds ${p.maxPerScenario} per scenario`,
        });
      }
    }
  }

  // Build candidates list
  const candidates = [...reasons.values()].sort(
    (a, b) => new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime(),
  );

  // Build per-scenario summary
  const scenarioSummary: ScenarioRetention[] = [];
  for (const [scenario, group] of scenarioEntries) {
    const removedCount = group.filter((g) => removeSet.has(g.index)).length;
    scenarioSummary.push({
      scenario,
      total: group.length,
      keep: group.length - removedCount,
      remove: removedCount,
    });
  }
  scenarioSummary.sort((a, b) => a.scenario.localeCompare(b.scenario));

  return {
    candidates,
    keepCount: entries.length - removeSet.size,
    totalCount: entries.length,
    policy: p,
    scenarioSummary,
  };
}

/**
 * Format retention policy evaluation report.
 */
export function formatRetention(result: RetentionResult): string {
  const lines: string[] = [];
  lines.push('Retention Policy Report');
  lines.push('═'.repeat(60));
  lines.push('');

  lines.push('  Policy:');
  lines.push(`    Max age:          ${result.policy.maxAgeDays} days`);
  lines.push(`    Max count:        ${result.policy.maxCount}`);
  lines.push(`    Max per scenario: ${result.policy.maxPerScenario}`);
  lines.push(`    Min per scenario: ${result.policy.minPerScenario}`);
  lines.push(`    Keep failed:      ${result.policy.keepFailed ? 'yes' : 'no'}`);
  lines.push('');

  if (result.candidates.length === 0) {
    lines.push('  ✓ All recordings comply with retention policy.');
    lines.push(`  Total: ${result.totalCount} recordings`);
    return lines.join('\n');
  }

  const byReason = {
    age: result.candidates.filter((c) => c.reason === 'age').length,
    count: result.candidates.filter((c) => c.reason === 'count').length,
    per_scenario_count: result.candidates.filter((c) => c.reason === 'per_scenario_count').length,
  };

  lines.push('  Candidates for removal:');
  if (byReason.age > 0) lines.push(`    Expired (age):        ${byReason.age}`);
  if (byReason.count > 0) lines.push(`    Over count limit:     ${byReason.count}`);
  if (byReason.per_scenario_count > 0) lines.push(`    Over scenario limit:  ${byReason.per_scenario_count}`);
  lines.push('');

  if (result.scenarioSummary.length > 0) {
    lines.push('  Per-scenario breakdown:');
    for (const s of result.scenarioSummary) {
      if (s.remove > 0) {
        lines.push(`    ${s.scenario.padEnd(25)} ${s.keep} keep / ${s.remove} remove (of ${s.total})`);
      }
    }
    lines.push('');
  }

  lines.push(`  Summary: ${result.candidates.length} to remove, ${result.keepCount} to keep (of ${result.totalCount} total)`);
  return lines.join('\n');
}
