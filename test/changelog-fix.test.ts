import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateChangelog, formatChangelog, type SessionData } from '../src/analytics/changelog.js';

describe('formatChangelog duplicate date headers fix', () => {
  it('groups sessions on the same date under one header', () => {
    const sessions: SessionData[] = [
      {
        timestamp: '2026-04-10_08-00',
        scenarios: [{ name: 'basic', status: 'ok', bugs: 0, duration: 10 }],
      },
      {
        timestamp: '2026-04-10_14-00',
        scenarios: [{ name: 'basic', status: 'ok', bugs: 0, duration: 12 }],
      },
    ];

    const entries = generateChangelog(sessions);
    const output = formatChangelog(entries);

    // Should only have one "## 2026-04-10" header
    const dateHeaders = output.split('\n').filter((l) => l === '## 2026-04-10');
    expect(dateHeaders.length).toBe(1);
  });

  it('shows separate headers for different dates', () => {
    const sessions: SessionData[] = [
      {
        timestamp: '2026-04-10_08-00',
        scenarios: [{ name: 'basic', status: 'ok', bugs: 0, duration: 10 }],
      },
      {
        timestamp: '2026-04-11_08-00',
        scenarios: [{ name: 'basic', status: 'ok', bugs: 0, duration: 12 }],
      },
    ];

    const entries = generateChangelog(sessions);
    const output = formatChangelog(entries);

    expect(output).toContain('## 2026-04-10');
    expect(output).toContain('## 2026-04-11');
  });

  it('shows session timestamps as sub-headings', () => {
    const sessions: SessionData[] = [
      {
        timestamp: '2026-04-10_08-00',
        scenarios: [{ name: 'basic', status: 'ok', bugs: 0, duration: 10 }],
      },
      {
        timestamp: '2026-04-10_14-00',
        scenarios: [{ name: 'basic', status: 'ok', bugs: 1, duration: 12 }],
      },
    ];

    const entries = generateChangelog(sessions);
    const output = formatChangelog(entries);

    expect(output).toContain('### Session 2026-04-10_14-00');
    expect(output).toContain('### Session 2026-04-10_08-00');
  });
});
