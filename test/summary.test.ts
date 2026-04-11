import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeSession, formatSessionSummary, type SessionSummary } from '../src/pipeline/summary.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.includes('basic/report.json')) {
      return JSON.stringify({
        scenario: 'basic',
        overall_status: 'ok',
        bugs_found: 0,
        duration_seconds: 10.5,
      });
    }
    if (path.includes('advanced/report.json')) {
      return JSON.stringify({
        scenario: 'advanced',
        overall_status: 'error',
        bugs_found: 3,
        duration_seconds: 15.0,
      });
    }
    throw new Error(`Not found: ${path}`);
  }),
  readdir: vi.fn(async (path: string) => {
    if (path.includes('2026-04-11_08-00')) return ['basic', 'advanced'];
    return [];
  }),
  stat: vi.fn(async () => ({ isDirectory: () => false, size: 1024 })),
  realpath: vi.fn(async () => '/output/2026-04-11_08-00'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (path.includes('report.json')) return true;
    if (path.includes('raw.mp4')) return true;
    if (path.includes('2026-04-11_08-00')) return true;
    if (path.includes('latest')) return true;
    return false;
  }),
}));

describe('summarizeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates summary for a session', async () => {
    const summary = await summarizeSession('/output', '2026-04-11_08-00');
    expect(summary.scenarioCount).toBe(2);
    expect(summary.passedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.totalBugs).toBe(3);
  });

  it('calculates total duration', async () => {
    const summary = await summarizeSession('/output', '2026-04-11_08-00');
    expect(summary.totalDuration).toBeCloseTo(25.5, 1);
  });

  it('includes per-scenario details', async () => {
    const summary = await summarizeSession('/output', '2026-04-11_08-00');
    expect(summary.scenarios.length).toBe(2);
    expect(summary.scenarios[0].name).toBe('basic');
    expect(summary.scenarios[1].name).toBe('advanced');
  });

  it('throws for non-existent session', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockImplementation((path: any) => {
      if (path.includes('nonexistent')) return false;
      return true;
    });
    await expect(summarizeSession('/output', 'nonexistent')).rejects.toThrow('Session not found');
  });

  it('tracks video presence', async () => {
    const summary = await summarizeSession('/output', '2026-04-11_08-00');
    expect(summary.scenarios[0].hasVideo).toBe(true);
  });
});

describe('formatSessionSummary', () => {
  it('formats summary as readable dashboard', () => {
    const summary: SessionSummary = {
      sessionId: '2026-04-11_08-00',
      sessionPath: '/output/2026-04-11_08-00',
      scenarioCount: 2,
      passedCount: 1,
      failedCount: 1,
      totalBugs: 3,
      totalDuration: 25.5,
      diskUsageBytes: 1024 * 1024,
      scenarios: [
        { name: 'basic', status: 'ok', bugs: 0, duration: 10.5, hasVideo: true, hasReport: true },
        { name: 'advanced', status: 'error', bugs: 3, duration: 15.0, hasVideo: true, hasReport: true },
      ],
    };

    const output = formatSessionSummary(summary);
    expect(output).toContain('Session Summary');
    expect(output).toContain('50%'); // Pass rate
    expect(output).toContain('basic');
    expect(output).toContain('advanced');
    expect(output).toContain('3 bugs');
  });

  it('shows pass/fail icons', () => {
    const summary: SessionSummary = {
      sessionId: '2026-04-11_08-00',
      sessionPath: '/output/2026-04-11_08-00',
      scenarioCount: 1,
      passedCount: 1,
      failedCount: 0,
      totalBugs: 0,
      totalDuration: 10,
      diskUsageBytes: 512,
      scenarios: [
        { name: 'basic', status: 'ok', bugs: 0, duration: 10, hasVideo: true, hasReport: true },
      ],
    };

    const output = formatSessionSummary(summary);
    expect(output).toContain('✓');
    expect(output).toContain('100%');
  });

  it('shows disk usage in MB', () => {
    const summary: SessionSummary = {
      sessionId: 'test',
      sessionPath: '/test',
      scenarioCount: 0,
      passedCount: 0,
      failedCount: 0,
      totalBugs: 0,
      totalDuration: 0,
      diskUsageBytes: 5 * 1024 * 1024,
      scenarios: [],
    };

    const output = formatSessionSummary(summary);
    expect(output).toContain('5.0 MB');
  });
});
