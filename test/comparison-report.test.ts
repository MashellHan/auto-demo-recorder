import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateComparisonReport, formatComparisonReport } from '../src/analytics/comparison-report.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.includes('sessionA/basic/report.json')) {
      return JSON.stringify({ scenario: 'basic', overall_status: 'ok', bugs_found: 0, duration_seconds: 10 });
    }
    if (path.includes('sessionA/advanced/report.json')) {
      return JSON.stringify({ scenario: 'advanced', overall_status: 'ok', bugs_found: 1, duration_seconds: 20 });
    }
    if (path.includes('sessionB/basic/report.json')) {
      return JSON.stringify({ scenario: 'basic', overall_status: 'warning', bugs_found: 2, duration_seconds: 12 });
    }
    if (path.includes('sessionB/advanced/report.json')) {
      return JSON.stringify({ scenario: 'advanced', overall_status: 'ok', bugs_found: 1, duration_seconds: 18 });
    }
    if (path.includes('identical-a/demo/report.json')) {
      return JSON.stringify({ scenario: 'demo', overall_status: 'ok', bugs_found: 0, duration_seconds: 15 });
    }
    if (path.includes('identical-b/demo/report.json')) {
      return JSON.stringify({ scenario: 'demo', overall_status: 'ok', bugs_found: 0, duration_seconds: 15 });
    }
    throw new Error(`Not found: ${path}`);
  }),
  readdir: vi.fn(async (path: string) => {
    if (path.endsWith('sessionA')) return ['basic', 'advanced'];
    if (path.endsWith('sessionB')) return ['basic', 'advanced'];
    if (path.endsWith('identical-a')) return ['demo'];
    if (path.endsWith('identical-b')) return ['demo'];
    if (path.endsWith('partial-a')) return ['basic', 'only-in-a'];
    if (path.endsWith('partial-b')) return ['basic', 'only-in-b'];
    return [];
  }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (path.includes('report.json')) return true;
    if (path.endsWith('sessionA') || path.endsWith('sessionB')) return true;
    if (path.endsWith('identical-a') || path.endsWith('identical-b')) return true;
    if (path.endsWith('partial-a') || path.endsWith('partial-b')) return true;
    if (path.endsWith('missing')) return false;
    return false;
  }),
}));

describe('generateComparisonReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates report with status and bug differences', async () => {
    const report = await generateComparisonReport('/output', 'sessionA', 'sessionB');
    expect(report.comparisons).toHaveLength(2);
    expect(report.totalScenarios).toBe(2);

    const basic = report.comparisons.find((c) => c.scenario === 'basic');
    expect(basic).toBeDefined();
    expect(basic!.statusChanged).toBe(true);
    expect(basic!.bugsChanged).toBe(true);
    expect(basic!.bugsA).toBe(0);
    expect(basic!.bugsB).toBe(2);
  });

  it('reports identical sessions with no changes', async () => {
    const report = await generateComparisonReport('/output', 'identical-a', 'identical-b');
    expect(report.statusChanges).toBe(0);
    expect(report.bugChanges).toBe(0);
    expect(report.comparisons[0].statusChanged).toBe(false);
  });

  it('returns empty report for missing session', async () => {
    const report = await generateComparisonReport('/output', 'missing', 'sessionB');
    expect(report.onlyInB.length).toBeGreaterThan(0);
    expect(report.comparisons).toHaveLength(0);
  });

  it('detects scenario-level differences (unchanged advanced)', async () => {
    const report = await generateComparisonReport('/output', 'sessionA', 'sessionB');
    const advanced = report.comparisons.find((c) => c.scenario === 'advanced');
    expect(advanced).toBeDefined();
    expect(advanced!.statusChanged).toBe(false);
    expect(advanced!.bugsChanged).toBe(false);
  });
});

describe('formatComparisonReport', () => {
  it('formats empty report', () => {
    const output = formatComparisonReport({
      sessionA: 'a',
      sessionB: 'b',
      comparisons: [],
      onlyInA: [],
      onlyInB: [],
      totalScenarios: 0,
      statusChanges: 0,
      bugChanges: 0,
    });
    expect(output).toContain('No scenarios found');
  });

  it('formats report with changes', () => {
    const output = formatComparisonReport({
      sessionA: '2026-04-10_08-00',
      sessionB: '2026-04-11_08-00',
      comparisons: [
        {
          scenario: 'basic',
          statusA: 'ok',
          statusB: 'warning',
          bugsA: 0,
          bugsB: 2,
          durationA: 10,
          durationB: 12,
          statusChanged: true,
          bugsChanged: true,
        },
      ],
      onlyInA: [],
      onlyInB: [],
      totalScenarios: 1,
      statusChanges: 1,
      bugChanges: 1,
    });
    expect(output).toContain('Session Comparison');
    expect(output).toContain('basic');
    expect(output).toContain('✓');
    expect(output).toContain('⚠');
    expect(output).toContain('↑');
  });

  it('shows only-in lists', () => {
    const output = formatComparisonReport({
      sessionA: 'a',
      sessionB: 'b',
      comparisons: [],
      onlyInA: ['old-scenario'],
      onlyInB: ['new-scenario'],
      totalScenarios: 2,
      statusChanges: 0,
      bugChanges: 0,
    });
    expect(output).toContain('Only in a');
    expect(output).toContain('old-scenario');
    expect(output).toContain('Only in b');
    expect(output).toContain('new-scenario');
  });
});
