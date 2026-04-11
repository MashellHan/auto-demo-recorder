import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendHistoryEntry,
  readHistory,
  historyStats,
  formatHistoryTable,
  type HistoryEntry,
} from '../src/analytics/history.js';

const TEST_DIR = join(tmpdir(), 'history-test-' + Date.now());

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  timestamp: '2026-04-11T08:00:00Z',
  sessionId: '2026-04-11_08-00',
  scenario: 'basic',
  status: 'ok',
  durationSeconds: 10,
  bugsFound: 0,
  backend: 'vhs',
  ...overrides,
});

describe('history', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('appends and reads back an entry', async () => {
    const entry = makeEntry();
    await appendHistoryEntry(TEST_DIR, entry);
    const entries = await readHistory(TEST_DIR);
    expect(entries).toHaveLength(1);
    expect(entries[0].scenario).toBe('basic');
  });

  it('appends multiple entries', async () => {
    await appendHistoryEntry(TEST_DIR, makeEntry({ timestamp: '2026-04-11T08:00:00Z' }));
    await appendHistoryEntry(TEST_DIR, makeEntry({ timestamp: '2026-04-11T09:00:00Z', scenario: 'advanced' }));
    const entries = await readHistory(TEST_DIR);
    expect(entries).toHaveLength(2);
    // Newest first
    expect(entries[0].scenario).toBe('advanced');
  });

  it('filters by date range', async () => {
    await appendHistoryEntry(TEST_DIR, makeEntry({ timestamp: '2026-04-01T08:00:00Z' }));
    await appendHistoryEntry(TEST_DIR, makeEntry({ timestamp: '2026-04-10T08:00:00Z', scenario: 'recent' }));

    const entries = await readHistory(TEST_DIR, {
      since: new Date('2026-04-05T00:00:00Z'),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].scenario).toBe('recent');
  });

  it('filters by scenario name', async () => {
    await appendHistoryEntry(TEST_DIR, makeEntry({ scenario: 'basic' }));
    await appendHistoryEntry(TEST_DIR, makeEntry({ scenario: 'advanced' }));

    const entries = await readHistory(TEST_DIR, { scenario: 'basic' });
    expect(entries).toHaveLength(1);
    expect(entries[0].scenario).toBe('basic');
  });

  it('filters by status', async () => {
    await appendHistoryEntry(TEST_DIR, makeEntry({ status: 'ok' }));
    await appendHistoryEntry(TEST_DIR, makeEntry({ status: 'error', scenario: 'failing' }));

    const entries = await readHistory(TEST_DIR, { status: 'error' });
    expect(entries).toHaveLength(1);
    expect(entries[0].scenario).toBe('failing');
  });

  it('returns empty for non-existent directory', async () => {
    const entries = await readHistory('/nonexistent-dir-xyz');
    expect(entries).toEqual([]);
  });

  it('skips corrupt lines', async () => {
    const filePath = join(TEST_DIR, 'recordings-history.jsonl');
    const content = [
      JSON.stringify(makeEntry()),
      'corrupt line here {{{',
      JSON.stringify(makeEntry({ scenario: 'good' })),
    ].join('\n') + '\n';

    await writeFile(filePath, content, 'utf-8');
    const entries = await readHistory(TEST_DIR);
    expect(entries).toHaveLength(2);
  });

  it('applies limit', async () => {
    for (let i = 0; i < 5; i++) {
      await appendHistoryEntry(TEST_DIR, makeEntry({
        timestamp: `2026-04-${String(i + 1).padStart(2, '0')}T08:00:00Z`,
        scenario: `scenario-${i}`,
      }));
    }
    const entries = await readHistory(TEST_DIR, { limit: 2 });
    expect(entries).toHaveLength(2);
  });
});

describe('historyStats', () => {
  it('computes stats correctly', () => {
    const entries: HistoryEntry[] = [
      makeEntry({ status: 'ok', durationSeconds: 10, bugsFound: 0 }),
      makeEntry({ status: 'error', durationSeconds: 20, bugsFound: 3 }),
      makeEntry({ status: 'warning', durationSeconds: 15, bugsFound: 1 }),
    ];
    const stats = historyStats(entries);
    expect(stats.total).toBe(3);
    expect(stats.okCount).toBe(1);
    expect(stats.errorCount).toBe(1);
    expect(stats.warningCount).toBe(1);
    expect(stats.avgDuration).toBe(15);
    expect(stats.totalBugs).toBe(4);
  });

  it('handles empty entries', () => {
    const stats = historyStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgDuration).toBe(0);
  });
});

describe('formatHistoryTable', () => {
  it('shows no history message for empty', () => {
    const output = formatHistoryTable([]);
    expect(output).toContain('No recording history');
  });

  it('formats entries as table', () => {
    const output = formatHistoryTable([
      makeEntry({ status: 'ok', scenario: 'basic' }),
      makeEntry({ status: 'error', scenario: 'failing', bugsFound: 3 }),
    ]);
    expect(output).toContain('Recording History');
    expect(output).toContain('basic');
    expect(output).toContain('failing');
    expect(output).toContain('✓');
    expect(output).toContain('✗');
  });
});
