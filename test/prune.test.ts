import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pruneRecordings, formatPruneReport } from '../src/pipeline/prune.js';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(async (dir: string, opts?: { withFileTypes?: boolean }) => {
    // Top-level output directory
    if (!opts?.withFileTypes) {
      return [
        '2026-04-01_08-00',
        '2026-04-05_10-00',
        '2026-04-10_12-00',
        '2026-04-11_09-00',
        'latest',
        'session-report.json',
      ];
    }
    // For recursive size calculation
    return [
      { name: 'report.json', isDirectory: () => false },
      { name: 'raw.mp4', isDirectory: () => false },
    ];
  }),
  stat: vi.fn(async () => ({ size: 1024 * 1024 })), // 1 MB each
  rm: vi.fn(async () => {}),
}));

describe('pruneRecordings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prunes oldest sessions when keepCount is specified', async () => {
    const result = await pruneRecordings({
      outputDir: '/output',
      keepCount: 2,
    });

    expect(result.pruned).toEqual(['2026-04-01_08-00', '2026-04-05_10-00']);
    expect(result.kept).toEqual(['2026-04-10_12-00', '2026-04-11_09-00']);
  });

  it('prunes sessions older than maxAgeDays', async () => {
    // Mock "now" as 2026-04-11, so 10 days ago = 2026-04-01
    vi.setSystemTime(new Date('2026-04-11T12:00:00Z'));

    const result = await pruneRecordings({
      outputDir: '/output',
      maxAgeDays: 5, // Anything older than Apr 6
    });

    expect(result.pruned).toContain('2026-04-01_08-00');
    expect(result.pruned).toContain('2026-04-05_10-00');
    expect(result.kept).toContain('2026-04-10_12-00');
    expect(result.kept).toContain('2026-04-11_09-00');

    vi.useRealTimers();
  });

  it('respects dryRun flag — no deletions', async () => {
    const { rm } = await import('node:fs/promises');

    const result = await pruneRecordings({
      outputDir: '/output',
      keepCount: 2,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.pruned).toHaveLength(2);
    expect(rm).not.toHaveBeenCalled();
  });

  it('calls rm for non-dry-run deletions', async () => {
    const { rm } = await import('node:fs/promises');

    await pruneRecordings({
      outputDir: '/output',
      keepCount: 3,
    });

    expect(rm).toHaveBeenCalledTimes(1);
    expect(rm).toHaveBeenCalledWith(
      expect.stringContaining('2026-04-01_08-00'),
      expect.objectContaining({ recursive: true, force: true }),
    );
  });

  it('keeps all sessions when keepCount exceeds total', async () => {
    const result = await pruneRecordings({
      outputDir: '/output',
      keepCount: 100,
    });

    expect(result.pruned).toHaveLength(0);
    expect(result.kept).toHaveLength(4);
  });

  it('computes freed bytes', async () => {
    const result = await pruneRecordings({
      outputDir: '/output',
      keepCount: 2,
    });

    // Each session has 2 files × 1MB = 2MB per session, 2 sessions pruned
    expect(result.freedBytes).toBe(2 * 2 * 1024 * 1024);
  });

  it('filters out non-timestamp entries', async () => {
    const result = await pruneRecordings({
      outputDir: '/output',
      keepCount: 10,
    });

    // "latest" and "session-report.json" should be ignored
    expect(result.kept).not.toContain('latest');
    expect(result.kept).not.toContain('session-report.json');
    expect(result.kept).toHaveLength(4);
  });
});

describe('formatPruneReport', () => {
  it('shows no-prune message when nothing to delete', () => {
    const report = formatPruneReport({
      pruned: [],
      kept: ['2026-04-11_09-00'],
      freedBytes: 0,
      dryRun: false,
    });

    expect(report).toContain('No sessions to prune');
    expect(report).toContain('Keeping 1 session');
  });

  it('shows dry run indicator', () => {
    const report = formatPruneReport({
      pruned: ['2026-04-01_08-00'],
      kept: ['2026-04-11_09-00'],
      freedBytes: 1024 * 1024,
      dryRun: true,
    });

    expect(report).toContain('[DRY RUN]');
    expect(report).toContain('2026-04-01_08-00');
  });

  it('formats freed space in human-readable units', () => {
    const report = formatPruneReport({
      pruned: ['2026-04-01_08-00'],
      kept: [],
      freedBytes: 5 * 1024 * 1024, // 5 MB
      dryRun: false,
    });

    expect(report).toContain('5.0 MB');
  });
});
