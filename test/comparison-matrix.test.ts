import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateComparisonMatrix, formatComparisonMatrix } from '../src/analytics/comparison-matrix.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.includes('basic/report.json')) {
      return JSON.stringify({ scenario: 'basic', overall_status: 'ok', bugs_found: 0, duration_seconds: 10 });
    }
    if (path.includes('advanced/report.json')) {
      return JSON.stringify({ scenario: 'advanced', overall_status: 'warning', bugs_found: 2, duration_seconds: 15 });
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

describe('generateComparisonMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates matrix with sessions and scenarios', async () => {
    const matrix = await generateComparisonMatrix('/test/output');
    expect(matrix.sessions.length).toBe(2);
    expect(matrix.scenarios).toContain('basic');
    expect(matrix.scenarios).toContain('advanced');
  });

  it('has correct row data', async () => {
    const matrix = await generateComparisonMatrix('/test/output');
    const firstRow = matrix.rows[0];
    const basicCell = firstRow.cells.get('basic');
    expect(basicCell).toBeDefined();
    expect(basicCell!.status).toBe('ok');
  });

  it('marks missing scenarios in later rows', async () => {
    const matrix = await generateComparisonMatrix('/test/output');
    const firstRow = matrix.rows[0]; // 2026-04-10 only has basic
    const advancedCell = firstRow.cells.get('advanced');
    expect(advancedCell).toBeUndefined();
  });

  it('returns empty matrix for non-existent directory', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);
    const matrix = await generateComparisonMatrix('/nonexistent');
    expect(matrix.sessions).toEqual([]);
  });
});

describe('formatComparisonMatrix', () => {
  it('formats empty matrix', () => {
    const output = formatComparisonMatrix({ sessions: [], scenarios: [], rows: [] });
    expect(output).toContain('No recording sessions');
  });

  it('formats matrix with data', () => {
    const output = formatComparisonMatrix({
      sessions: ['2026-04-10_08-00'],
      scenarios: ['basic'],
      rows: [{
        sessionId: '2026-04-10_08-00',
        cells: new Map([['basic', { status: 'ok', bugs: 0, duration: 10, exists: true }]]),
      }],
    });
    expect(output).toContain('Comparison Matrix');
    expect(output).toContain('basic');
    expect(output).toContain('✓');
  });
});
