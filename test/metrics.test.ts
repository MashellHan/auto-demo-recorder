import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeMetrics, formatMetrics } from '../src/analytics/metrics.js';

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
        overall_status: 'warning',
        bugs_found: 2,
        duration_seconds: 15.0,
      });
    }
    throw new Error(`Not found: ${path}`);
  }),
  readdir: vi.fn(async (path: string) => {
    if (path.endsWith('output')) return ['2026-04-10_08-00', '2026-04-11_08-00', 'latest'];
    if (path.includes('2026-04-10_08-00')) return ['basic'];
    if (path.includes('2026-04-11_08-00')) return ['basic', 'advanced'];
    return [];
  }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (path.includes('report.json')) return true;
    if (path.endsWith('output')) return true;
    return false;
  }),
}));

describe('computeMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes overall stability', async () => {
    const metrics = await computeMetrics('/test/output');
    expect(metrics.overallStability).toBeGreaterThan(0);
    expect(metrics.totalSessions).toBe(2);
  });

  it('computes per-scenario metrics', async () => {
    const metrics = await computeMetrics('/test/output');
    expect(metrics.scenarios.length).toBeGreaterThanOrEqual(1);
    const basic = metrics.scenarios.find((s) => s.name === 'basic');
    expect(basic).toBeDefined();
    expect(basic!.sessionCount).toBe(2);
  });

  it('computes bug density', async () => {
    const metrics = await computeMetrics('/test/output');
    expect(metrics.bugDensity).toBeGreaterThanOrEqual(0);
  });

  it('returns empty metrics for non-existent directory', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);
    const metrics = await computeMetrics('/nonexistent');
    expect(metrics.scenarios).toEqual([]);
    expect(metrics.overallStability).toBe(100);
  });

  it('returns empty metrics for empty directory', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValueOnce([]);
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    const metrics = await computeMetrics('/empty');
    expect(metrics.totalSessions).toBe(0);
  });
});

describe('formatMetrics', () => {
  it('formats metrics as readable text', () => {
    const output = formatMetrics({
      scenarios: [
        { name: 'basic', stability: 1, avgBugs: 0, bugTrend: 0, avgDuration: 10.5, durationStdDev: 0.5, sessionCount: 5 },
      ],
      overallStability: 100,
      bugDensity: 0,
      totalSessions: 5,
      totalScenarios: 5,
    });

    expect(output).toContain('Recording Quality Metrics');
    expect(output).toContain('100%');
    expect(output).toContain('basic');
  });

  it('shows trend indicators', () => {
    const output = formatMetrics({
      scenarios: [
        { name: 'basic', stability: 0.5, avgBugs: 2, bugTrend: 1, avgDuration: 10, durationStdDev: 2, sessionCount: 4 },
      ],
      overallStability: 50,
      bugDensity: 2,
      totalSessions: 4,
      totalScenarios: 4,
    });

    expect(output).toContain('↑'); // Bug trend increasing
    expect(output).toContain('✗'); // Low stability
  });

  it('handles empty scenarios', () => {
    const output = formatMetrics({
      scenarios: [],
      overallStability: 100,
      bugDensity: 0,
      totalSessions: 0,
      totalScenarios: 0,
    });

    expect(output).toContain('No scenario data');
  });
});
