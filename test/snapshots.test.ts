import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  saveSnapshot,
  listSnapshots,
  restoreSnapshot,
  deleteSnapshot,
  formatSnapshotList,
} from '../src/pipeline/snapshots.js';

const TEST_DIR = join(tmpdir(), 'snapshot-test-' + Date.now());
const SESSION_ID = '2026-04-11_08-00';

describe('snapshots', () => {
  beforeEach(async () => {
    const sessionDir = join(TEST_DIR, SESSION_ID, 'basic');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'report.json'), '{"status":"ok"}', 'utf-8');
    await writeFile(join(TEST_DIR, SESSION_ID, 'basic', 'raw.mp4'), 'video-data', 'utf-8');
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('saves a snapshot of a session', async () => {
    const result = await saveSnapshot(TEST_DIR, SESSION_ID);
    expect(result.snapshot.sessionId).toBe(SESSION_ID);
    expect(result.filesCopied).toBeGreaterThan(0);
    expect(existsSync(result.snapshot.path)).toBe(true);
  });

  it('saves a snapshot with a label', async () => {
    const result = await saveSnapshot(TEST_DIR, SESSION_ID, 'pre-fix');
    expect(result.snapshot.label).toBe('pre-fix');
    expect(result.snapshot.id).toContain('pre-fix');
  });

  it('lists snapshots for a session', async () => {
    await saveSnapshot(TEST_DIR, SESSION_ID, 'v1');
    await saveSnapshot(TEST_DIR, SESSION_ID, 'v2');
    const snapshots = await listSnapshots(TEST_DIR, SESSION_ID);
    expect(snapshots).toHaveLength(2);
  });

  it('returns empty for session with no snapshots', async () => {
    const snapshots = await listSnapshots(TEST_DIR, 'nonexistent');
    expect(snapshots).toEqual([]);
  });

  it('restores a session from snapshot', async () => {
    const saved = await saveSnapshot(TEST_DIR, SESSION_ID, 'checkpoint');

    // Modify the session after snapshot
    await writeFile(join(TEST_DIR, SESSION_ID, 'basic', 'report.json'), '{"status":"error"}', 'utf-8');

    // Restore from snapshot
    const result = await restoreSnapshot(TEST_DIR, SESSION_ID, saved.snapshot.id);
    expect(result.filesRestored).toBeGreaterThan(0);

    // Verify restoration
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(join(TEST_DIR, SESSION_ID, 'basic', 'report.json'), 'utf-8');
    expect(content).toContain('ok');
  });

  it('throws for non-existent snapshot on restore', async () => {
    await expect(
      restoreSnapshot(TEST_DIR, SESSION_ID, 'nonexistent'),
    ).rejects.toThrow('Snapshot not found');
  });

  it('deletes a snapshot', async () => {
    const saved = await saveSnapshot(TEST_DIR, SESSION_ID, 'deleteme');
    const deleted = await deleteSnapshot(TEST_DIR, SESSION_ID, saved.snapshot.id);
    expect(deleted).toBe(true);

    const snapshots = await listSnapshots(TEST_DIR, SESSION_ID);
    expect(snapshots).toHaveLength(0);
  });

  it('returns false for deleting non-existent snapshot', async () => {
    const deleted = await deleteSnapshot(TEST_DIR, SESSION_ID, 'ghost');
    expect(deleted).toBe(false);
  });

  it('throws for saving snapshot of non-existent session', async () => {
    await expect(
      saveSnapshot(TEST_DIR, 'nonexistent-session'),
    ).rejects.toThrow('Session not found');
  });
});

describe('formatSnapshotList', () => {
  it('shows no snapshots message for empty', () => {
    const output = formatSnapshotList([]);
    expect(output).toContain('No snapshots found');
  });

  it('formats snapshots with details', () => {
    const output = formatSnapshotList([
      {
        id: '2026-04-11T08-00-00_checkpoint',
        sessionId: '2026-04-11_08-00',
        label: 'checkpoint',
        createdAt: '2026-04-11T08:00:00Z',
        path: '/output/.snapshots/2026-04-11_08-00/2026-04-11T08-00-00_checkpoint',
      },
    ]);
    expect(output).toContain('Recording Snapshots');
    expect(output).toContain('checkpoint');
    expect(output).toContain('2026-04-11_08-00');
    expect(output).toContain('1 snapshot');
  });
});
