/**
 * Recording duplicate detection — identify duplicate or near-duplicate
 * entries in recording history.
 *
 * Detects exact duplicates (same scenario + session + status) and
 * near-duplicates (same scenario + similar timestamp within a window).
 */

import type { HistoryEntry } from './history.js';

/** A duplicate group. */
export interface DuplicateGroup {
  /** The scenario name. */
  readonly scenario: string;
  /** All entries in this duplicate group. */
  readonly entries: readonly HistoryEntry[];
  /** Number of duplicate entries (total - 1). */
  readonly duplicateCount: number;
  /** Duplicate type. */
  readonly type: 'exact' | 'near';
}

/** Duplicate detection result. */
export interface DuplicateResult {
  /** Detected duplicate groups. */
  readonly groups: readonly DuplicateGroup[];
  /** Total entries analyzed. */
  readonly totalAnalyzed: number;
  /** Total duplicate entries found. */
  readonly totalDuplicates: number;
  /** Entries that would remain after deduplication. */
  readonly uniqueCount: number;
}

/**
 * Generate a fingerprint for exact duplicate detection.
 */
function exactFingerprint(entry: HistoryEntry): string {
  return `${entry.scenario}|${entry.sessionId}|${entry.status}|${entry.durationSeconds}|${entry.bugsFound}|${entry.backend}`;
}

/**
 * Generate a fingerprint for near-duplicate detection.
 */
function nearFingerprint(entry: HistoryEntry): string {
  return `${entry.scenario}|${entry.status}|${entry.backend}`;
}

/**
 * Detect duplicate recordings in history.
 *
 * @param entries - History entries to analyze.
 * @param windowSeconds - Time window for near-duplicate detection (default: 60s).
 */
export function detectDuplicates(
  entries: readonly HistoryEntry[],
  windowSeconds: number = 60,
): DuplicateResult {
  const groups: DuplicateGroup[] = [];

  // Phase 1: Exact duplicates
  const exactGroups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const fp = exactFingerprint(entry);
    const list = exactGroups.get(fp) ?? [];
    list.push(entry);
    exactGroups.set(fp, list);
  }

  const exactDupFingerprints = new Set<string>();
  for (const [fp, group] of exactGroups) {
    if (group.length > 1) {
      exactDupFingerprints.add(fp);
      groups.push({
        scenario: group[0].scenario,
        entries: group,
        duplicateCount: group.length - 1,
        type: 'exact',
      });
    }
  }

  // Phase 2: Near-duplicates (same scenario+status+backend within time window)
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const nearGroups = new Map<string, HistoryEntry[][]>();

  for (const entry of sorted) {
    const fp = nearFingerprint(entry);
    // Skip if already caught as exact duplicate
    if (exactDupFingerprints.has(exactFingerprint(entry))) continue;

    const chains = nearGroups.get(fp) ?? [];
    let added = false;

    for (const chain of chains) {
      const lastInChain = chain[chain.length - 1];
      const timeDiff = Math.abs(
        new Date(entry.timestamp).getTime() - new Date(lastInChain.timestamp).getTime(),
      ) / 1000;

      if (timeDiff <= windowSeconds) {
        chain.push(entry);
        added = true;
        break;
      }
    }

    if (!added) {
      chains.push([entry]);
    }

    nearGroups.set(fp, chains);
  }

  for (const chains of nearGroups.values()) {
    for (const chain of chains) {
      if (chain.length > 1) {
        groups.push({
          scenario: chain[0].scenario,
          entries: chain,
          duplicateCount: chain.length - 1,
          type: 'near',
        });
      }
    }
  }

  const totalDuplicates = groups.reduce((sum, g) => sum + g.duplicateCount, 0);

  return {
    groups,
    totalAnalyzed: entries.length,
    totalDuplicates,
    uniqueCount: entries.length - totalDuplicates,
  };
}

/**
 * Format duplicate detection results.
 */
export function formatDuplicates(result: DuplicateResult): string {
  const lines: string[] = [];
  lines.push('Duplicate Detection');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.groups.length === 0) {
    lines.push('  ✓ No duplicates found.');
    lines.push(`  Analyzed: ${result.totalAnalyzed} recordings`);
    return lines.join('\n');
  }

  const exactGroups = result.groups.filter((g) => g.type === 'exact');
  const nearGroups = result.groups.filter((g) => g.type === 'near');

  if (exactGroups.length > 0) {
    lines.push(`  Exact Duplicates: ${exactGroups.length} group(s)`);
    for (const g of exactGroups) {
      lines.push(`    ${g.scenario}: ${g.entries.length} copies (${g.duplicateCount} extra)`);
    }
    lines.push('');
  }

  if (nearGroups.length > 0) {
    lines.push(`  Near-Duplicates: ${nearGroups.length} group(s)`);
    for (const g of nearGroups) {
      const firstTs = g.entries[0].timestamp.slice(0, 19).replace('T', ' ');
      const lastTs = g.entries[g.entries.length - 1].timestamp.slice(0, 19).replace('T', ' ');
      lines.push(`    ${g.scenario}: ${g.entries.length} entries from ${firstTs} to ${lastTs}`);
    }
    lines.push('');
  }

  lines.push(`  Summary: ${result.totalDuplicates} duplicates in ${result.totalAnalyzed} recordings`);
  lines.push(`  After dedup: ${result.uniqueCount} unique recordings`);
  return lines.join('\n');
}
