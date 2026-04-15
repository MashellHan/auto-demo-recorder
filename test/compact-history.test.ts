import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compactHistory } from '../src/analytics/history.js';
import type { HistoryEntry } from '../src/analytics/history.js';

const TEST_DIR = join(tmpdir(), 'compact-history-test-' + Date.now());
const HISTORY_FILE = 'recordings-history.jsonl';

/** Generate a timestamp N days ago from now. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  timestamp: daysAgo(0),
  sessionId: '2026-04-11_08-00',
  scenario: 'basic',
  status: 'ok',
  durationSeconds: 10,
  bugsFound: 0,
  backend: 'vhs',
  ...overrides,
});

/** Write entries directly to the JSONL file. */
async function writeEntries(entries: HistoryEntry[]): Promise<void> {
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await writeFile(join(TEST_DIR, HISTORY_FILE), content, 'utf-8');
}

/** Read raw lines from the JSONL file. */
async function readEntries(): Promise<HistoryEntry[]> {
  const content = await readFile(join(TEST_DIR, HISTORY_FILE), 'utf-8');
  return content
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as HistoryEntry);
}

describe('compactHistory', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('removes entries exceeding maxCount', async () => {
    // Create 10 entries with relative timestamps, compact to keep 3
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 10; i++) {
      entries.push(
        makeEntry({
          timestamp: daysAgo(10 - i),
          sessionId: `session-${i}`,
          scenario: 'basic',
        }),
      );
    }
    await writeEntries(entries);

    const result = await compactHistory(TEST_DIR, { maxCount: 3 });

    expect(result.removedCount).toBe(7);
    expect(result.keptCount).toBe(3);
    expect(result.totalBefore).toBe(10);
    expect(result.dryRun).toBe(false);

    // Verify file was rewritten with 3 newest entries
    const remaining = await readEntries();
    expect(remaining).toHaveLength(3);
  });

  it('creates a backup file before compacting', async () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(1) }),
      makeEntry({ timestamp: daysAgo(2), scenario: 'other' }),
    ];
    await writeEntries(entries);

    await compactHistory(TEST_DIR, { maxCount: 1 });

    // Backup file should exist
    const backupPath = join(TEST_DIR, 'recordings-history.jsonl.bak');
    expect(existsSync(backupPath)).toBe(true);

    // Backup should contain original content
    const backupContent = await readFile(backupPath, 'utf-8');
    const backupEntries = backupContent
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as HistoryEntry);
    expect(backupEntries).toHaveLength(2);
  });

  it('does not leave temp files after successful compaction', async () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(1) }),
      makeEntry({ timestamp: daysAgo(2), scenario: 'other' }),
    ];
    await writeEntries(entries);

    await compactHistory(TEST_DIR, { maxCount: 1 });

    // .tmp file should be cleaned up (renamed to main file)
    const tmpPath = join(TEST_DIR, 'recordings-history.jsonl.tmp');
    expect(existsSync(tmpPath)).toBe(false);
  });

  it('respects dry-run mode (no file changes)', async () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(1) }),
      makeEntry({ timestamp: daysAgo(2) }),
    ];
    await writeEntries(entries);

    const result = await compactHistory(TEST_DIR, { maxCount: 1 }, true);

    expect(result.dryRun).toBe(true);
    expect(result.removedCount).toBe(1);
    expect(result.keptCount).toBe(1);

    // File should be unchanged
    const remaining = await readEntries();
    expect(remaining).toHaveLength(2);

    // No backup should exist
    const backupPath = join(TEST_DIR, 'recordings-history.jsonl.bak');
    expect(existsSync(backupPath)).toBe(false);
  });

  it('handles empty history gracefully', async () => {
    await writeFile(join(TEST_DIR, HISTORY_FILE), '', 'utf-8');

    const result = await compactHistory(TEST_DIR, { maxCount: 100 });

    expect(result.removedCount).toBe(0);
    expect(result.keptCount).toBe(0);
    expect(result.totalBefore).toBe(0);
  });

  it('handles non-existent history file', async () => {
    const result = await compactHistory(TEST_DIR, { maxCount: 100 });

    expect(result.removedCount).toBe(0);
    expect(result.keptCount).toBe(0);
    expect(result.totalBefore).toBe(0);
  });

  it('preserves chronological order after compaction', async () => {
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 5; i++) {
      entries.push(
        makeEntry({
          timestamp: daysAgo(5 - i),
          scenario: `scenario-${i}`,
        }),
      );
    }
    await writeEntries(entries);

    await compactHistory(TEST_DIR, { maxCount: 3 });

    const remaining = await readEntries();
    expect(remaining).toHaveLength(3);
    // Should be in chronological order (oldest first in file)
    const timestamps = remaining.map((e) => new Date(e.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it('removes old entries by age', async () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(60), scenario: 'old-one' }),
      makeEntry({ timestamp: daysAgo(1), scenario: 'recent-one' }),
    ];
    await writeEntries(entries);

    const result = await compactHistory(TEST_DIR, { maxAgeDays: 30 });

    expect(result.removedCount).toBe(1);
    expect(result.keptCount).toBe(1);

    const remaining = await readEntries();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].scenario).toBe('recent-one');
  });

  it('keeps failed recordings when keepFailed is true', async () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(60), scenario: 'old-ok', status: 'ok' }),
      makeEntry({ timestamp: daysAgo(60), scenario: 'old-fail', status: 'error' }),
    ];
    await writeEntries(entries);

    const result = await compactHistory(TEST_DIR, { maxAgeDays: 30, keepFailed: true });

    expect(result.removedCount).toBe(1);
    // The failed recording should be kept
    const remaining = await readEntries();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].scenario).toBe('old-fail');
  });

  it('returns formatted summary with entry counts', async () => {
    const entries = [
      makeEntry({ timestamp: daysAgo(1) }),
      makeEntry({ timestamp: daysAgo(2) }),
    ];
    await writeEntries(entries);

    const result = await compactHistory(TEST_DIR, { maxCount: 1 });

    expect(result.summary).toContain('Compacted');
    expect(result.summary).toContain('1 of 2 entries');
  });

  it('correctly handles duplicate-keyed entries (same timestamp/scenario/session)', async () => {
    // Two entries with identical keys — only the older one should be removed by count
    const ts = daysAgo(1);
    const entries = [
      makeEntry({ timestamp: daysAgo(5), scenario: 'alpha', sessionId: 'old' }),
      makeEntry({ timestamp: ts, scenario: 'basic', sessionId: 'same' }),
      makeEntry({ timestamp: ts, scenario: 'basic', sessionId: 'same' }),
    ];
    await writeEntries(entries);

    const result = await compactHistory(TEST_DIR, { maxCount: 2 });

    // Only the oldest entry should be removed, both duplicates should be kept
    expect(result.removedCount).toBe(1);
    expect(result.keptCount).toBe(2);

    const remaining = await readEntries();
    expect(remaining).toHaveLength(2);
  });
});
