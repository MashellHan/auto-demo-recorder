import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkBaseline, formatBaselineComparison, listBaselines, type BaselineComparison } from '../src/analytics/baseline.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.includes('baselines/basic.json')) {
      return JSON.stringify({
        scenario: 'basic',
        savedAt: '2026-04-10T10:00:00.000Z',
        status: 'ok',
        bugs: 0,
        duration: 10.0,
        frames: 5,
        reportPath: '/output/2026-04-10_10-00/basic/report.json',
      });
    }
    if (path.includes('report.json')) {
      return JSON.stringify({
        scenario: 'basic',
        overall_status: 'ok',
        bugs_found: 0,
        duration_seconds: 10.5,
        total_frames_analyzed: 5,
      });
    }
    throw new Error(`Not found: ${path}`);
  }),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  realpath: vi.fn(async () => '/output/2026-04-11_09-00'),
  readdir: vi.fn(async (path: string) => {
    if (path.includes('baselines')) {
      return ['basic.json', 'advanced.json'];
    }
    return [];
  }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (path.includes('baselines/basic.json')) return true;
    if (path.includes('baselines/nonexistent.json')) return false;
    if (path.includes('latest')) return true;
    if (path.includes('report.json')) return true;
    if (path.includes('baselines')) return true;
    return false;
  }),
}));

describe('checkBaseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes when recording matches baseline', async () => {
    const result = await checkBaseline('/output', 'basic');
    expect(result.passed).toBe(true);
    expect(result.scenarioName).toBe('basic');
  });

  it('detects duration changes beyond threshold', async () => {
    const { readFile } = await import('node:fs/promises');
    vi.mocked(readFile).mockImplementation(async (path: any) => {
      if (path.includes('baselines/basic.json')) {
        return JSON.stringify({
          scenario: 'basic', savedAt: '2026-04-10T10:00:00Z',
          status: 'ok', bugs: 0, duration: 5.0, frames: 5,
          reportPath: '/output/old/report.json',
        });
      }
      return JSON.stringify({
        scenario: 'basic', overall_status: 'ok',
        bugs_found: 0, duration_seconds: 10.0, total_frames_analyzed: 5,
      });
    });

    const result = await checkBaseline('/output', 'basic');
    const durationChange = result.changes.find((c) => c.field === 'Duration');
    expect(durationChange).toBeDefined();
    expect(durationChange!.severity).toBe('warning');
  });

  it('detects status regression', async () => {
    const { readFile } = await import('node:fs/promises');
    vi.mocked(readFile).mockImplementation(async (path: any) => {
      if (path.includes('baselines/basic.json')) {
        return JSON.stringify({
          scenario: 'basic', savedAt: '2026-04-10T10:00:00Z',
          status: 'ok', bugs: 0, duration: 10, frames: 5,
          reportPath: '/output/old/report.json',
        });
      }
      return JSON.stringify({
        scenario: 'basic', overall_status: 'error',
        bugs_found: 2, duration_seconds: 10, total_frames_analyzed: 5,
      });
    });

    const result = await checkBaseline('/output', 'basic');
    expect(result.passed).toBe(false);
    const statusChange = result.changes.find((c) => c.field === 'Status');
    expect(statusChange).toBeDefined();
    expect(statusChange!.severity).toBe('error');
  });

  it('throws when no baseline exists', async () => {
    await expect(checkBaseline('/output', 'nonexistent')).rejects.toThrow('No baseline found');
  });
});

describe('formatBaselineComparison', () => {
  it('shows PASS for matching baseline', () => {
    const comparison: BaselineComparison = {
      scenarioName: 'basic',
      baselineTimestamp: '2026-04-10T10:00:00Z',
      currentTimestamp: '2026-04-11T10:00:00Z',
      changes: [],
      passed: true,
    };

    const output = formatBaselineComparison(comparison);
    expect(output).toContain('PASS');
    expect(output).toContain('No changes');
  });

  it('shows FAIL for regression', () => {
    const comparison: BaselineComparison = {
      scenarioName: 'basic',
      baselineTimestamp: '2026-04-10T10:00:00Z',
      currentTimestamp: '2026-04-11T10:00:00Z',
      changes: [{ field: 'Bugs', baseline: 0, current: 3, severity: 'error', description: 'Bugs increased' }],
      passed: false,
    };

    const output = formatBaselineComparison(comparison);
    expect(output).toContain('FAIL');
    expect(output).toContain('Bugs increased');
    expect(output).toContain('✗');
  });

  it('shows warnings for non-breaking changes', () => {
    const comparison: BaselineComparison = {
      scenarioName: 'basic',
      baselineTimestamp: '2026-04-10T10:00:00Z',
      currentTimestamp: '2026-04-11T10:00:00Z',
      changes: [{ field: 'Duration', baseline: 10, current: 15, severity: 'warning', description: 'Duration increased by 50%' }],
      passed: true,
    };

    const output = formatBaselineComparison(comparison);
    expect(output).toContain('PASS');
    expect(output).toContain('⚠');
  });
});

describe('listBaselines', () => {
  it('lists all saved baselines', async () => {
    const baselines = await listBaselines('/output');
    expect(baselines.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no baselines directory', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockImplementation((path: any) => {
      if (path.includes('baselines')) return false;
      return false;
    });

    const baselines = await listBaselines('/output');
    expect(baselines).toEqual([]);
  });
});
