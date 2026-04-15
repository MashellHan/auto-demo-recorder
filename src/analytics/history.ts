import { readFile, appendFile, writeFile, copyFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { evaluateRetention, type RetentionPolicy } from './retention.js';

/** A single recording history entry. */
export interface HistoryEntry {
  /** ISO timestamp of the recording. */
  timestamp: string;
  /** Session identifier (e.g., "2026-04-11_08-00"). */
  sessionId: string;
  /** Scenario name. */
  scenario: string;
  /** Recording status ("ok", "warning", "error"). */
  status: string;
  /** Duration in seconds. */
  durationSeconds: number;
  /** Number of bugs found. */
  bugsFound: number;
  /** Recording backend used. */
  backend: string;
}

/** Options for filtering history entries. */
export interface HistoryFilter {
  /** Only include entries after this date. */
  since?: Date;
  /** Only include entries before this date. */
  until?: Date;
  /** Filter by scenario name (case-insensitive). */
  scenario?: string;
  /** Filter by status. */
  status?: string;
  /** Maximum number of entries to return. */
  limit?: number;
}

const HISTORY_FILE = 'recordings-history.jsonl';

/**
 * Append a recording history entry to the JSONL log.
 */
export async function appendHistoryEntry(outputDir: string, entry: HistoryEntry): Promise<void> {
  const filePath = join(outputDir, HISTORY_FILE);

  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const line = JSON.stringify(entry) + '\n';
  await appendFile(filePath, line, 'utf-8');
}

/**
 * Read recording history with optional filtering.
 * Returns entries in reverse chronological order (newest first).
 */
export async function readHistory(
  outputDir: string,
  filter?: HistoryFilter,
): Promise<HistoryEntry[]> {
  const filePath = join(outputDir, HISTORY_FILE);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  let entries: HistoryEntry[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as HistoryEntry;
      entries.push(entry);
    } catch {
      // Skip corrupt lines — don't crash
    }
  }

  // Apply filters
  if (filter?.since) {
    const sinceMs = filter.since.getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() >= sinceMs);
  }
  if (filter?.until) {
    const untilMs = filter.until.getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() <= untilMs);
  }
  if (filter?.scenario) {
    const lower = filter.scenario.toLowerCase();
    entries = entries.filter((e) => e.scenario.toLowerCase().includes(lower));
  }
  if (filter?.status) {
    const lower = filter.status.toLowerCase();
    entries = entries.filter((e) => e.status.toLowerCase() === lower);
  }

  // Reverse chronological
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply limit
  if (filter?.limit && filter.limit > 0) {
    entries = entries.slice(0, filter.limit);
  }

  return entries;
}

/**
 * Get history summary statistics.
 */
export function historyStats(entries: readonly HistoryEntry[]): {
  total: number;
  okCount: number;
  errorCount: number;
  warningCount: number;
  avgDuration: number;
  totalBugs: number;
} {
  const total = entries.length;
  const okCount = entries.filter((e) => e.status === 'ok').length;
  const errorCount = entries.filter((e) => e.status === 'error' || e.status === 'fail').length;
  const warningCount = entries.filter((e) => e.status === 'warning').length;
  const avgDuration = total > 0 ? entries.reduce((sum, e) => sum + e.durationSeconds, 0) / total : 0;
  const totalBugs = entries.reduce((sum, e) => sum + e.bugsFound, 0);

  return { total, okCount, errorCount, warningCount, avgDuration, totalBugs };
}

/** Format a status icon. */
function statusIcon(status: string): string {
  if (status === 'ok') return '✓';
  if (status === 'error' || status === 'fail') return '✗';
  return '⚠';
}

/**
 * Format history entries as a human-readable table.
 */
export function formatHistoryTable(entries: readonly HistoryEntry[]): string {
  const lines: string[] = [];

  if (entries.length === 0) {
    lines.push('  No recording history found.');
    return lines.join('\n');
  }

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  Recording History');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  // Stats summary
  const stats = historyStats(entries);
  lines.push(`  Total: ${stats.total}  OK: ${stats.okCount}  Errors: ${stats.errorCount}  Warnings: ${stats.warningCount}`);
  lines.push(`  Avg Duration: ${stats.avgDuration.toFixed(1)}s  Total Bugs: ${stats.totalBugs}`);
  lines.push('');

  // Table header
  lines.push('  ─────────────────────────────────────────────────────');
  lines.push('  Timestamp            Session          Scenario         Status  Bugs  Duration');
  lines.push('  ─────────────────────────────────────────────────────');

  for (const entry of entries) {
    const ts = entry.timestamp.slice(0, 19).replace('T', ' ');
    const session = entry.sessionId.padEnd(16).slice(0, 16);
    const scenario = entry.scenario.padEnd(16).slice(0, 16);
    const status = `${statusIcon(entry.status)} ${entry.status.padEnd(5)}`;
    const bugs = String(entry.bugsFound).padStart(4);
    const dur = `${entry.durationSeconds.toFixed(1)}s`;

    lines.push(`  ${ts}  ${session}  ${scenario}  ${status}  ${bugs}  ${dur}`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Result of a history compaction operation. */
export interface CompactResult {
  /** Number of entries removed. */
  readonly removedCount: number;
  /** Number of entries kept. */
  readonly keptCount: number;
  /** Total entries before compaction. */
  readonly totalBefore: number;
  /** Whether this was a dry run. */
  readonly dryRun: boolean;
  /** Human-readable summary. */
  readonly summary: string;
}

/**
 * Compact recording history by applying a retention policy.
 *
 * Reads all history entries, evaluates them against the retention policy,
 * creates a backup of the original file, and rewrites the JSONL file
 * containing only the kept entries.
 *
 * @param outputDir - Directory containing the recordings-history.jsonl file
 * @param policy - Retention policy to apply (defaults from retention.ts)
 * @param dryRun - If true, report what would be removed without modifying files
 */
export async function compactHistory(
  outputDir: string,
  policy: RetentionPolicy = {},
  dryRun = false,
): Promise<CompactResult> {
  const filePath = join(outputDir, HISTORY_FILE);

  // Read all entries
  const allEntries = await readHistory(outputDir);

  if (allEntries.length === 0) {
    return {
      removedCount: 0,
      keptCount: 0,
      totalBefore: 0,
      dryRun,
      summary: 'No history entries to compact.',
    };
  }

  // Evaluate retention policy
  const retention = evaluateRetention(allEntries, policy);

  // Use object identity (reference equality) to track candidates for removal.
  // This avoids composite-key collisions where two entries share the same
  // (timestamp, scenario, sessionId) triple but only one should be removed.
  const candidateSet = new Set<HistoryEntry>(
    retention.candidates.map((c) => c.entry),
  );

  // Separate kept entries from removed
  const keptEntries = allEntries.filter((e) => !candidateSet.has(e));

  const removedCount = allEntries.length - keptEntries.length;

  if (removedCount === 0) {
    return {
      removedCount: 0,
      keptCount: allEntries.length,
      totalBefore: allEntries.length,
      dryRun,
      summary: `All ${allEntries.length} entries comply with retention policy. Nothing to compact.`,
    };
  }

  if (!dryRun) {
    // Atomic write: write to temp file first, then backup original, then rename.
    // This prevents data loss if the process crashes mid-write.
    const tmpPath = filePath + '.tmp';
    const backupPath = filePath + '.bak';

    // Rewrite file with kept entries in chronological order (oldest first)
    const sorted = [...keptEntries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const content = sorted.map((e) => JSON.stringify(e)).join('\n') + '\n';

    await writeFile(tmpPath, content, 'utf-8');
    await copyFile(filePath, backupPath);
    await rename(tmpPath, filePath);
  }

  const summary = dryRun
    ? `[DRY RUN] Would compact ${removedCount} of ${allEntries.length} entries (keeping ${keptEntries.length}).`
    : `Compacted ${removedCount} of ${allEntries.length} entries. ${keptEntries.length} entries remaining. Backup saved to ${HISTORY_FILE}.bak`;

  return {
    removedCount,
    keptCount: keptEntries.length,
    totalBefore: allEntries.length,
    dryRun,
    summary,
  };
}
