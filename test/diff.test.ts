import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const { diffSessions, formatSessionDiff } = await import('../src/analytics/diff.js');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('diffSessions', () => {
  const makeReport = (scenario: string, overrides: Record<string, unknown> = {}) => ({
    project: 'test',
    scenario,
    timestamp: '2026-04-11T08:00:00Z',
    duration_seconds: 10,
    total_frames_analyzed: 3,
    overall_status: 'ok',
    frames: [],
    summary: 'ok',
    bugs_found: 0,
    ...overrides,
  });

  it('returns empty when both sessions are missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await diffSessions('/recordings', 'session-a', 'session-b');

    expect(result.diffs).toHaveLength(0);
  });

  it('detects unchanged scenarios', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    // Session A
    vi.mocked(readdir)
      .mockResolvedValueOnce([
        { name: 'basic', isDirectory: () => true },
      ] as never)
      // Session B
      .mockResolvedValueOnce([
        { name: 'basic', isDirectory: () => true },
      ] as never);

    const report = makeReport('basic');
    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(report) as never)
      .mockResolvedValueOnce(JSON.stringify(report) as never);

    const result = await diffSessions('/recordings', 'a', 'b');

    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].trend).toBe('unchanged');
    expect(result.unchanged).toBe(1);
  });

  it('detects improved scenario (bugs fixed)', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readdir)
      .mockResolvedValueOnce([{ name: 'basic', isDirectory: () => true }] as never)
      .mockResolvedValueOnce([{ name: 'basic', isDirectory: () => true }] as never);

    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(makeReport('basic', { bugs_found: 3, overall_status: 'warning' })) as never)
      .mockResolvedValueOnce(JSON.stringify(makeReport('basic', { bugs_found: 0, overall_status: 'ok' })) as never);

    const result = await diffSessions('/recordings', 'a', 'b');

    expect(result.diffs[0].trend).toBe('improved');
    expect(result.improved).toBe(1);
    expect(result.diffs[0].bugsA).toBe(3);
    expect(result.diffs[0].bugsB).toBe(0);
  });

  it('detects regressed scenario (new bugs)', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readdir)
      .mockResolvedValueOnce([{ name: 'basic', isDirectory: () => true }] as never)
      .mockResolvedValueOnce([{ name: 'basic', isDirectory: () => true }] as never);

    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(makeReport('basic', { bugs_found: 0 })) as never)
      .mockResolvedValueOnce(JSON.stringify(makeReport('basic', { bugs_found: 2, overall_status: 'error' })) as never);

    const result = await diffSessions('/recordings', 'a', 'b');

    expect(result.diffs[0].trend).toBe('regressed');
    expect(result.regressed).toBe(1);
  });

  it('detects new scenarios in session B', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readdir)
      .mockResolvedValueOnce([] as never) // Session A: empty
      .mockResolvedValueOnce([{ name: 'new-feature', isDirectory: () => true }] as never);

    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(makeReport('new-feature')) as never);

    const result = await diffSessions('/recordings', 'a', 'b');

    expect(result.diffs[0].trend).toBe('new');
    expect(result.newScenarios).toBe(1);
  });

  it('detects removed scenarios from session A', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readdir)
      .mockResolvedValueOnce([{ name: 'old-feature', isDirectory: () => true }] as never)
      .mockResolvedValueOnce([] as never); // Session B: empty

    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(makeReport('old-feature')) as never);

    const result = await diffSessions('/recordings', 'a', 'b');

    expect(result.diffs[0].trend).toBe('removed');
    expect(result.removedScenarios).toBe(1);
  });

  it('computes duration delta correctly', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readdir)
      .mockResolvedValueOnce([{ name: 'basic', isDirectory: () => true }] as never)
      .mockResolvedValueOnce([{ name: 'basic', isDirectory: () => true }] as never);

    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(makeReport('basic', { duration_seconds: 10 })) as never)
      .mockResolvedValueOnce(JSON.stringify(makeReport('basic', { duration_seconds: 12 })) as never);

    const result = await diffSessions('/recordings', 'a', 'b');

    expect(result.diffs[0].durationDelta).toBe(2);
    expect(result.diffs[0].durationDeltaPct).toBe(20);
  });

  it('handles mixed scenario changes', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readdir)
      .mockResolvedValueOnce([
        { name: 'basic', isDirectory: () => true },
        { name: 'advanced', isDirectory: () => true },
      ] as never)
      .mockResolvedValueOnce([
        { name: 'basic', isDirectory: () => true },
        { name: 'new-test', isDirectory: () => true },
      ] as never);

    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(makeReport('basic')) as never)
      .mockResolvedValueOnce(JSON.stringify(makeReport('advanced', { bugs_found: 1 })) as never)
      .mockResolvedValueOnce(JSON.stringify(makeReport('basic')) as never)
      .mockResolvedValueOnce(JSON.stringify(makeReport('new-test')) as never);

    const result = await diffSessions('/recordings', 'a', 'b');

    expect(result.diffs).toHaveLength(3);
    expect(result.unchanged).toBe(1); // basic
    expect(result.removedScenarios).toBe(1); // advanced
    expect(result.newScenarios).toBe(1); // new-test
  });
});

describe('formatSessionDiff', () => {
  it('formats empty diff', () => {
    const result = formatSessionDiff({
      sessionA: 'a', sessionB: 'b',
      diffs: [], improved: 0, regressed: 0, unchanged: 0,
      newScenarios: 0, removedScenarios: 0,
    });

    expect(result).toContain('No scenarios found');
  });

  it('formats improved scenario', () => {
    const result = formatSessionDiff({
      sessionA: '2026-04-11_08-00',
      sessionB: '2026-04-11_09-00',
      diffs: [{
        scenario: 'basic', durationA: 10, durationB: 8, durationDelta: -2, durationDeltaPct: -20,
        statusA: 'warning', statusB: 'ok', bugsA: 2, bugsB: 0, framesA: 3, framesB: 3, trend: 'improved',
      }],
      improved: 1, regressed: 0, unchanged: 0, newScenarios: 0, removedScenarios: 0,
    });

    expect(result).toContain('✅');
    expect(result).toContain('IMPROVED');
    expect(result).toContain('FIXED');
    expect(result).toContain('1 improved');
  });

  it('formats regressed scenario', () => {
    const result = formatSessionDiff({
      sessionA: 'a', sessionB: 'b',
      diffs: [{
        scenario: 'basic', durationA: 10, durationB: 12, durationDelta: 2, durationDeltaPct: 20,
        statusA: 'ok', statusB: 'error', bugsA: 0, bugsB: 3, framesA: 3, framesB: 3, trend: 'regressed',
      }],
      improved: 0, regressed: 1, unchanged: 0, newScenarios: 0, removedScenarios: 0,
    });

    expect(result).toContain('❌');
    expect(result).toContain('REGRESSED');
    expect(result).toContain('NEW BUGS');
    expect(result).toContain('1 regressed');
  });

  it('formats new and removed scenarios', () => {
    const result = formatSessionDiff({
      sessionA: 'a', sessionB: 'b',
      diffs: [
        { scenario: 'new-one', durationA: 0, durationB: 5, durationDelta: 5, durationDeltaPct: 0, statusA: '', statusB: 'ok', bugsA: 0, bugsB: 0, framesA: 0, framesB: 3, trend: 'new' },
        { scenario: 'old-one', durationA: 10, durationB: 0, durationDelta: -10, durationDeltaPct: -100, statusA: 'ok', statusB: '', bugsA: 0, bugsB: 0, framesA: 3, framesB: 0, trend: 'removed' },
      ],
      improved: 0, regressed: 0, unchanged: 0, newScenarios: 1, removedScenarios: 1,
    });

    expect(result).toContain('🆕');
    expect(result).toContain('NEW');
    expect(result).toContain('REMOVED');
    expect(result).toContain('1 new');
    expect(result).toContain('1 removed');
  });
});
