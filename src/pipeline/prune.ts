import { readdir, stat, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

/** Options for pruning old recordings. */
export interface PruneOptions {
  /** Output directory containing recording sessions. */
  outputDir: string;
  /** Maximum number of sessions to keep (newest are kept). */
  keepCount?: number;
  /** Maximum age in days — sessions older than this are pruned. */
  maxAgeDays?: number;
  /** Dry run — report what would be deleted without actually deleting. */
  dryRun?: boolean;
}

/** Result of a prune operation. */
export interface PruneResult {
  /** Sessions that were (or would be) deleted. */
  pruned: string[];
  /** Sessions that are retained. */
  kept: string[];
  /** Total disk space freed (or to be freed) in bytes. */
  freedBytes: number;
  /** Whether this was a dry run. */
  dryRun: boolean;
}

/**
 * Prune old recording sessions based on count or age criteria.
 *
 * Sessions are identified by their timestamp directory names (YYYY-MM-DD_HH-MM).
 * The "latest" symlink is not counted as a session.
 */
export async function pruneRecordings(options: PruneOptions): Promise<PruneResult> {
  const { outputDir, keepCount, maxAgeDays, dryRun = false } = options;

  const entries = await readdir(outputDir);
  const sessions = entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/.test(e))
    .sort();

  if (sessions.length === 0) {
    return { pruned: [], kept: [...sessions], freedBytes: 0, dryRun };
  }

  const toPrune = new Set<string>();

  // Apply keepCount: prune oldest sessions beyond the keep threshold
  if (keepCount !== undefined && keepCount >= 0) {
    const toRemoveCount = Math.max(0, sessions.length - keepCount);
    for (let i = 0; i < toRemoveCount; i++) {
      toPrune.add(sessions[i]);
    }
  }

  // Apply maxAgeDays: prune sessions older than the threshold
  if (maxAgeDays !== undefined && maxAgeDays >= 0) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    for (const session of sessions) {
      const sessionDate = parseSessionTimestamp(session);
      if (sessionDate && sessionDate.getTime() < cutoff) {
        toPrune.add(session);
      }
    }
  }

  // Calculate sizes and execute deletions
  let freedBytes = 0;
  const prunedList: string[] = [];
  const keptList: string[] = [];

  for (const session of sessions) {
    const sessionPath = join(outputDir, session);
    if (toPrune.has(session)) {
      freedBytes += await getDirectorySize(sessionPath);
      prunedList.push(session);
      if (!dryRun) {
        await rm(sessionPath, { recursive: true, force: true });
      }
    } else {
      keptList.push(session);
    }
  }

  return { pruned: prunedList, kept: keptList, freedBytes, dryRun };
}

/**
 * Format a prune result as a human-readable report.
 */
export function formatPruneReport(result: PruneResult): string {
  const lines: string[] = [];
  const mode = result.dryRun ? '[DRY RUN] ' : '';

  if (result.pruned.length === 0) {
    lines.push(`${mode}No sessions to prune.`);
    lines.push(`Keeping ${result.kept.length} session(s).`);
    return lines.join('\n');
  }

  lines.push(`${mode}Prune Report`);
  lines.push('─'.repeat(40));

  lines.push(`\n${mode}Removing ${result.pruned.length} session(s):`);
  for (const session of result.pruned) {
    lines.push(`  ✗ ${session}`);
  }

  lines.push(`\nKeeping ${result.kept.length} session(s):`);
  for (const session of result.kept) {
    lines.push(`  ✓ ${session}`);
  }

  lines.push(`\n${mode}Space freed: ${formatBytes(result.freedBytes)}`);

  return lines.join('\n');
}

/** Parse a session timestamp string (YYYY-MM-DD_HH-MM) into a Date. */
function parseSessionTimestamp(timestamp: string): Date | null {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
  );
}

/** Recursively compute the total size of a directory in bytes. */
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const fullPath = resolve(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await getDirectorySize(fullPath);
      } else {
        const s = await stat(fullPath);
        total += s.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/** Format bytes into a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
