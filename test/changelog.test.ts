import { describe, it, expect } from 'vitest';
import { generateChangelog, formatChangelog, type ChangelogEntry } from '../src/analytics/changelog.js';

describe('generateChangelog', () => {
  it('generates entries from session data', () => {
    const sessions = [
      {
        timestamp: '2026-04-10_08-00',
        scenarios: [
          { name: 'basic', status: 'ok', bugs: 0, duration: 10 },
          { name: 'advanced', status: 'warning', bugs: 2, duration: 15 },
        ],
      },
      {
        timestamp: '2026-04-11_08-00',
        scenarios: [
          { name: 'basic', status: 'ok', bugs: 0, duration: 10 },
          { name: 'advanced', status: 'ok', bugs: 0, duration: 12 },
        ],
      },
    ];

    const entries = generateChangelog(sessions);

    expect(entries).toHaveLength(2);
    expect(entries[0].date).toBe('2026-04-11');
    expect(entries[1].date).toBe('2026-04-10');
  });

  it('tracks bug improvements', () => {
    const sessions = [
      {
        timestamp: '2026-04-10_08-00',
        scenarios: [
          { name: 'basic', status: 'warning', bugs: 3, duration: 10 },
        ],
      },
      {
        timestamp: '2026-04-11_08-00',
        scenarios: [
          { name: 'basic', status: 'ok', bugs: 0, duration: 10 },
        ],
      },
    ];

    const entries = generateChangelog(sessions);

    expect(entries[0].improvements).toHaveLength(1);
    expect(entries[0].improvements[0]).toContain('basic');
    expect(entries[0].improvements[0]).toContain('3→0');
  });

  it('tracks regressions', () => {
    const sessions = [
      {
        timestamp: '2026-04-10_08-00',
        scenarios: [
          { name: 'basic', status: 'ok', bugs: 0, duration: 10 },
        ],
      },
      {
        timestamp: '2026-04-11_08-00',
        scenarios: [
          { name: 'basic', status: 'warning', bugs: 2, duration: 10 },
        ],
      },
    ];

    const entries = generateChangelog(sessions);

    expect(entries[0].regressions).toHaveLength(1);
    expect(entries[0].regressions[0]).toContain('basic');
  });

  it('detects new scenarios', () => {
    const sessions = [
      {
        timestamp: '2026-04-10_08-00',
        scenarios: [
          { name: 'basic', status: 'ok', bugs: 0, duration: 10 },
        ],
      },
      {
        timestamp: '2026-04-11_08-00',
        scenarios: [
          { name: 'basic', status: 'ok', bugs: 0, duration: 10 },
          { name: 'advanced', status: 'ok', bugs: 0, duration: 15 },
        ],
      },
    ];

    const entries = generateChangelog(sessions);

    expect(entries[0].newScenarios).toContain('advanced');
  });

  it('handles single session (no comparison)', () => {
    const sessions = [
      {
        timestamp: '2026-04-10_08-00',
        scenarios: [
          { name: 'basic', status: 'ok', bugs: 0, duration: 10 },
        ],
      },
    ];

    const entries = generateChangelog(sessions);

    expect(entries).toHaveLength(1);
    expect(entries[0].improvements).toHaveLength(0);
    expect(entries[0].regressions).toHaveLength(0);
  });

  it('handles empty sessions', () => {
    const entries = generateChangelog([]);
    expect(entries).toHaveLength(0);
  });
});

describe('formatChangelog', () => {
  it('formats entries as human-readable text', () => {
    const entries: ChangelogEntry[] = [
      {
        date: '2026-04-11',
        timestamp: '2026-04-11_08-00',
        totalScenarios: 3,
        totalBugs: 0,
        improvements: ['advanced: 2→0 bugs (fixed)'],
        regressions: [],
        newScenarios: ['api-test'],
        removedScenarios: [],
      },
    ];

    const output = formatChangelog(entries);

    expect(output).toContain('## 2026-04-11');
    expect(output).toContain('Scenarios: 3');
    expect(output).toContain('Bugs: 0');
    expect(output).toContain('advanced: 2→0 bugs');
    expect(output).toContain('api-test');
  });

  it('shows regression warnings', () => {
    const entries: ChangelogEntry[] = [
      {
        date: '2026-04-11',
        timestamp: '2026-04-11_08-00',
        totalScenarios: 2,
        totalBugs: 3,
        improvements: [],
        regressions: ['login: 0→3 bugs (regressed)'],
        newScenarios: [],
        removedScenarios: [],
      },
    ];

    const output = formatChangelog(entries);

    expect(output).toContain('Regressions');
    expect(output).toContain('login: 0→3 bugs');
  });

  it('formats empty changelog', () => {
    const output = formatChangelog([]);
    expect(output).toContain('No recording history');
  });

  it('omits empty sections', () => {
    const entries: ChangelogEntry[] = [
      {
        date: '2026-04-11',
        timestamp: '2026-04-11_08-00',
        totalScenarios: 1,
        totalBugs: 0,
        improvements: [],
        regressions: [],
        newScenarios: [],
        removedScenarios: [],
      },
    ];

    const output = formatChangelog(entries);

    expect(output).not.toContain('Improvements');
    expect(output).not.toContain('Regressions');
    expect(output).not.toContain('New Scenarios');
  });
});
