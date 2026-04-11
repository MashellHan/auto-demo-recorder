import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  realpath: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const { computeStats, formatStats } = await import('../src/analytics/stats.js');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('computeStats', () => {
  it('returns empty stats when output directory does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const stats = await computeStats('/nonexistent');

    expect(stats.totalRecordings).toBe(0);
    expect(stats.uniqueScenarios).toEqual([]);
  });

  it('returns empty stats when no report files found', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue([
      { name: 'latest', isDirectory: () => true },
    ] as never);

    const stats = await computeStats('/recordings');

    expect(stats.totalRecordings).toBe(0);
  });

  it('scans recording directories and computes stats', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    // Top-level: two session directories + latest symlink
    vi.mocked(readdir)
      .mockResolvedValueOnce([
        { name: 'latest', isDirectory: () => true },
        { name: '2026-04-11_08-00', isDirectory: () => true },
        { name: '2026-04-11_09-00', isDirectory: () => true },
      ] as never)
      // Session 1 scenarios
      .mockResolvedValueOnce([
        { name: 'basic', isDirectory: () => true },
        { name: 'advanced', isDirectory: () => true },
      ] as never)
      // Session 2 scenarios
      .mockResolvedValueOnce([
        { name: 'basic', isDirectory: () => true },
      ] as never);

    const reportBasic1 = {
      project: 'test',
      scenario: 'basic',
      timestamp: '2026-04-11T08:00:00Z',
      duration_seconds: 10,
      total_frames_analyzed: 3,
      overall_status: 'ok',
      frames: [],
      summary: 'ok',
      bugs_found: 0,
    };

    const reportAdvanced = {
      project: 'test',
      scenario: 'advanced',
      timestamp: '2026-04-11T08:01:00Z',
      duration_seconds: 15,
      total_frames_analyzed: 5,
      overall_status: 'warning',
      frames: [],
      summary: 'warning',
      bugs_found: 2,
    };

    const reportBasic2 = {
      project: 'test',
      scenario: 'basic',
      timestamp: '2026-04-11T09:00:00Z',
      duration_seconds: 8,
      total_frames_analyzed: 3,
      overall_status: 'ok',
      frames: [],
      summary: 'ok',
      bugs_found: 0,
    };

    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(reportBasic1) as never)
      .mockResolvedValueOnce(JSON.stringify(reportAdvanced) as never)
      .mockResolvedValueOnce(JSON.stringify(reportBasic2) as never);

    const stats = await computeStats('/recordings');

    expect(stats.totalRecordings).toBe(3);
    expect(stats.uniqueScenarios).toContain('basic');
    expect(stats.uniqueScenarios).toContain('advanced');
    expect(stats.totalDurationSeconds).toBe(33); // 10 + 15 + 8
    expect(stats.totalBugs).toBe(2);
    expect(stats.totalRegressions).toBe(1); // 1 warning
    expect(stats.mostRecordedScenario).toBe('basic');
    expect(stats.mostRecordedCount).toBe(2);
    expect(stats.qualityTrend).toHaveLength(3);
    expect(stats.firstRecording).toBe('2026-04-11T08:00:00Z');
    expect(stats.lastRecording).toBe('2026-04-11T09:00:00Z');
  });

  it('skips malformed report.json files', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readdir)
      .mockResolvedValueOnce([
        { name: '2026-04-11_08-00', isDirectory: () => true },
      ] as never)
      .mockResolvedValueOnce([
        { name: 'basic', isDirectory: () => true },
      ] as never);

    vi.mocked(readFile).mockResolvedValueOnce('not valid json' as never);

    const stats = await computeStats('/recordings');

    expect(stats.totalRecordings).toBe(0);
  });

  it('skips non-directory entries', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readdir)
      .mockResolvedValueOnce([
        { name: 'readme.txt', isDirectory: () => false },
        { name: '2026-04-11_08-00', isDirectory: () => true },
      ] as never)
      .mockResolvedValueOnce([
        { name: 'report-summary.txt', isDirectory: () => false },
        { name: 'basic', isDirectory: () => true },
      ] as never);

    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      project: 'test',
      scenario: 'basic',
      timestamp: '2026-04-11T08:00:00Z',
      duration_seconds: 5,
      total_frames_analyzed: 1,
      overall_status: 'ok',
      frames: [],
      summary: 'ok',
      bugs_found: 0,
    }) as never);

    const stats = await computeStats('/recordings');

    expect(stats.totalRecordings).toBe(1);
  });

  it('limits quality trend to last 10 recordings', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    // Create 12 session directories
    const sessionDirs = Array.from({ length: 12 }, (_, i) => ({
      name: `2026-04-${String(i + 1).padStart(2, '0')}_08-00`,
      isDirectory: () => true,
    }));
    vi.mocked(readdir).mockResolvedValueOnce(sessionDirs as never);

    // Each session has one scenario
    for (let i = 0; i < 12; i++) {
      vi.mocked(readdir).mockResolvedValueOnce([
        { name: 'basic', isDirectory: () => true },
      ] as never);
    }

    for (let i = 0; i < 12; i++) {
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
        project: 'test',
        scenario: 'basic',
        timestamp: `2026-04-${String(i + 1).padStart(2, '0')}T08:00:00Z`,
        duration_seconds: 5,
        total_frames_analyzed: 1,
        overall_status: 'ok',
        frames: [],
        summary: 'ok',
        bugs_found: 0,
      }) as never);
    }

    const stats = await computeStats('/recordings');

    expect(stats.totalRecordings).toBe(12);
    expect(stats.qualityTrend).toHaveLength(10); // capped at 10
  });
});

describe('formatStats', () => {
  it('formats empty stats', () => {
    const result = formatStats({
      totalRecordings: 0,
      uniqueScenarios: [],
      totalDurationSeconds: 0,
      totalBugs: 0,
      totalRegressions: 0,
      mostRecordedScenario: '',
      mostRecordedCount: 0,
      qualityTrend: [],
      firstRecording: '',
      lastRecording: '',
    });

    expect(result).toContain('No recordings found');
  });

  it('formats stats with recordings', () => {
    const result = formatStats({
      totalRecordings: 24,
      uniqueScenarios: ['basic', 'advanced', 'full'],
      totalDurationSeconds: 272,
      totalBugs: 3,
      totalRegressions: 1,
      mostRecordedScenario: 'basic',
      mostRecordedCount: 10,
      qualityTrend: [
        { timestamp: '2026-04-11', scenario: 'basic', bugs: 0, status: 'ok' },
        { timestamp: '2026-04-12', scenario: 'basic', bugs: 1, status: 'warning' },
        { timestamp: '2026-04-13', scenario: 'basic', bugs: 0, status: 'ok' },
      ],
      firstRecording: '2026-04-01T08:00:00Z',
      lastRecording: '2026-04-13T09:00:00Z',
    });

    expect(result).toContain('Total recordings: 24');
    expect(result).toContain('Unique scenarios: 3');
    expect(result).toContain('4m 32s'); // 272 seconds
    expect(result).toContain('Bugs detected: 3');
    expect(result).toContain('Regressions found: 1');
    expect(result).toContain('Most recorded: basic (10 runs)');
    expect(result).toContain('Quality Trend');
    expect(result).toContain('✅');
    expect(result).toContain('⚠️');
    expect(result).toContain('(1 bug)');
  });

  it('formats short duration in seconds', () => {
    const result = formatStats({
      totalRecordings: 1,
      uniqueScenarios: ['test'],
      totalDurationSeconds: 45.2,
      totalBugs: 0,
      totalRegressions: 0,
      mostRecordedScenario: 'test',
      mostRecordedCount: 1,
      qualityTrend: [],
      firstRecording: '2026-04-01',
      lastRecording: '2026-04-01',
    });

    expect(result).toContain('45.2s');
  });

  it('shows error icon for error status in trend', () => {
    const result = formatStats({
      totalRecordings: 1,
      uniqueScenarios: ['test'],
      totalDurationSeconds: 5,
      totalBugs: 1,
      totalRegressions: 1,
      mostRecordedScenario: 'test',
      mostRecordedCount: 1,
      qualityTrend: [
        { timestamp: '2026-04-11', scenario: 'test', bugs: 1, status: 'error' },
      ],
      firstRecording: '2026-04-11',
      lastRecording: '2026-04-11',
    });

    expect(result).toContain('❌');
  });
});
