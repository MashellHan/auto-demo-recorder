import { mkdir, readdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/** A snapshot of a recording session at a point in time. */
export interface Snapshot {
  /** Snapshot identifier. */
  id: string;
  /** Session ID this snapshot belongs to. */
  sessionId: string;
  /** Optional human-readable label. */
  label?: string;
  /** ISO timestamp when snapshot was created. */
  createdAt: string;
  /** Path to the snapshot directory. */
  path: string;
}

/** Result of saving a snapshot. */
export interface SaveSnapshotResult {
  /** The created snapshot. */
  snapshot: Snapshot;
  /** Number of files copied. */
  filesCopied: number;
}

const SNAPSHOTS_DIR = '.snapshots';

/**
 * Save a snapshot (checkpoint) of the current session state.
 */
export async function saveSnapshot(
  outputDir: string,
  sessionId: string,
  label?: string,
): Promise<SaveSnapshotResult> {
  const sessionDir = join(outputDir, sessionId);
  if (!existsSync(sessionDir)) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const snapshotsDir = join(outputDir, SNAPSHOTS_DIR, sessionId);
  await mkdir(snapshotsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotId = label ? `${timestamp}_${label}` : timestamp;
  const snapshotDir = join(snapshotsDir, snapshotId);

  await cp(sessionDir, snapshotDir, { recursive: true });

  // Count files
  const entries = await readdir(snapshotDir, { recursive: true });
  const filesCopied = entries.length;

  const snapshot: Snapshot = {
    id: snapshotId,
    sessionId,
    label,
    createdAt: new Date().toISOString(),
    path: snapshotDir,
  };

  return { snapshot, filesCopied };
}

/**
 * List all snapshots for a given session.
 */
export async function listSnapshots(
  outputDir: string,
  sessionId: string,
): Promise<Snapshot[]> {
  const snapshotsDir = join(outputDir, SNAPSHOTS_DIR, sessionId);

  if (!existsSync(snapshotsDir)) {
    return [];
  }

  const entries = await readdir(snapshotsDir);
  const snapshots: Snapshot[] = [];

  for (const entry of entries) {
    const snapshotDir = join(snapshotsDir, entry);
    // Extract label from snapshot ID (after timestamp)
    const parts = entry.split('_');
    const label = parts.length > 3 ? parts.slice(3).join('_') : undefined;

    snapshots.push({
      id: entry,
      sessionId,
      label,
      createdAt: entry.replace(/-/g, (m, offset) => {
        // Reconstruct ISO from timestamp format
        if (offset <= 9) return '-';
        if (offset === 13) return ':';
        if (offset === 16) return ':';
        if (offset === 19) return '.';
        return '-';
      }),
      path: snapshotDir,
    });
  }

  // Sort newest first
  snapshots.sort((a, b) => b.id.localeCompare(a.id));
  return snapshots;
}

/**
 * Restore a session from a snapshot.
 * Overwrites the current session directory with the snapshot contents.
 */
export async function restoreSnapshot(
  outputDir: string,
  sessionId: string,
  snapshotId: string,
): Promise<{ restoredFrom: string; filesRestored: number }> {
  const snapshotDir = join(outputDir, SNAPSHOTS_DIR, sessionId, snapshotId);

  if (!existsSync(snapshotDir)) {
    throw new Error(`Snapshot not found: ${snapshotId} for session ${sessionId}`);
  }

  const sessionDir = join(outputDir, sessionId);

  // Remove current session contents
  if (existsSync(sessionDir)) {
    await rm(sessionDir, { recursive: true, force: true });
  }

  // Copy snapshot to session directory
  await cp(snapshotDir, sessionDir, { recursive: true });

  const entries = await readdir(sessionDir, { recursive: true });

  return {
    restoredFrom: snapshotDir,
    filesRestored: entries.length,
  };
}

/**
 * Delete a specific snapshot.
 */
export async function deleteSnapshot(
  outputDir: string,
  sessionId: string,
  snapshotId: string,
): Promise<boolean> {
  const snapshotDir = join(outputDir, SNAPSHOTS_DIR, sessionId, snapshotId);

  if (!existsSync(snapshotDir)) {
    return false;
  }

  await rm(snapshotDir, { recursive: true, force: true });
  return true;
}

/**
 * Format a list of snapshots as human-readable text.
 */
export function formatSnapshotList(snapshots: Snapshot[]): string {
  const lines: string[] = [];

  if (snapshots.length === 0) {
    lines.push('  No snapshots found.');
    return lines.join('\n');
  }

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  Recording Snapshots');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  for (const snap of snapshots) {
    const label = snap.label ? ` (${snap.label})` : '';
    lines.push(`  ${snap.id}${label}`);
    lines.push(`    Session: ${snap.sessionId}`);
    lines.push('');
  }

  lines.push(`  Total: ${snapshots.length} snapshot(s)`);
  return lines.join('\n');
}
