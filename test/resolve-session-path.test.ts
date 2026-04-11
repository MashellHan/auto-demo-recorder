import { describe, it, expect } from 'vitest';
import { resolveSessionPath, filterEntriesByConfig } from '../src/cli-utils.js';
import type { HistoryEntry } from '../src/analytics/history.js';
import type { Config } from '../src/config/schema.js';

function makeEntry(scenario: string): HistoryEntry {
  return {
    timestamp: '2026-04-11T10:00:00.000Z',
    sessionId: 's1',
    scenario,
    status: 'ok',
    durationSeconds: 5,
    bugsFound: 0,
    backend: 'vhs',
  };
}

function makeConfig(scenarioNames: string[], browserNames: string[] = []): Config {
  return {
    scenarios: scenarioNames.map((name) => ({ name, description: '', steps: [] })),
    browser_scenarios: browserNames.map((name) => ({ name, description: '', url: 'http://localhost', steps: [] })),
  } as unknown as Config;
}

describe('filterEntriesByConfig', () => {
  it('returns only entries matching config scenarios', () => {
    const entries = [makeEntry('a'), makeEntry('b'), makeEntry('c')];
    const config = makeConfig(['a', 'c']);
    const filtered = filterEntriesByConfig(entries, config);
    expect(filtered.map((e) => e.scenario)).toEqual(['a', 'c']);
  });

  it('includes browser scenario names', () => {
    const entries = [makeEntry('web'), makeEntry('cli')];
    const config = makeConfig([], ['web']);
    const filtered = filterEntriesByConfig(entries, config);
    expect(filtered.length).toBe(1);
    expect(filtered[0]!.scenario).toBe('web');
  });

  it('returns empty array when no scenarios match', () => {
    const entries = [makeEntry('x'), makeEntry('y')];
    const config = makeConfig(['a']);
    expect(filterEntriesByConfig(entries, config)).toEqual([]);
  });

  it('returns all entries when all match', () => {
    const entries = [makeEntry('a'), makeEntry('b')];
    const config = makeConfig(['a', 'b']);
    expect(filterEntriesByConfig(entries, config).length).toBe(2);
  });

  it('handles empty entries', () => {
    const config = makeConfig(['a']);
    expect(filterEntriesByConfig([], config)).toEqual([]);
  });

  it('handles empty config scenarios', () => {
    const entries = [makeEntry('a')];
    const config = makeConfig([]);
    expect(filterEntriesByConfig(entries, config)).toEqual([]);
  });
});

describe('resolveSessionPath', () => {
  const outputDir = '/project/.demo-recordings';

  it('returns path as-is when no prefix matches', () => {
    expect(resolveSessionPath(outputDir, '2026-04-11_08-00')).toBe('2026-04-11_08-00');
  });

  it('returns nested path as-is when no prefix matches', () => {
    expect(resolveSessionPath(outputDir, '2026-04-11_08-00/basic-navigation')).toBe('2026-04-11_08-00/basic-navigation');
  });

  it('strips relative output dir prefix', () => {
    expect(resolveSessionPath(outputDir, '.demo-recordings/2026-04-11_08-00/basic')).toBe('2026-04-11_08-00/basic');
  });

  it('strips ./ prefixed output dir', () => {
    expect(resolveSessionPath(outputDir, './.demo-recordings/2026-04-11_08-00/basic')).toBe('2026-04-11_08-00/basic');
  });

  it('strips absolute path containing output dir', () => {
    expect(resolveSessionPath(outputDir, '/project/.demo-recordings/2026-04-11_08-00')).toBe('2026-04-11_08-00');
  });

  it('handles trailing slashes in user path', () => {
    expect(resolveSessionPath(outputDir, '.demo-recordings/2026-04-11_08-00/')).toBe('2026-04-11_08-00');
  });

  it('does not strip partial directory name matches', () => {
    // e.g., ".demo-recordings-old/..." should NOT be stripped
    expect(resolveSessionPath(outputDir, '.demo-recordings-old/2026-04-11_08-00')).toBe('.demo-recordings-old/2026-04-11_08-00');
  });

  it('handles session-only timestamps (no scenario suffix)', () => {
    expect(resolveSessionPath(outputDir, '.demo-recordings/2026-04-11_08-00')).toBe('2026-04-11_08-00');
  });

  it('works with custom output dir names', () => {
    const customDir = '/project/recordings';
    expect(resolveSessionPath(customDir, 'recordings/2026-04-11_08-00/basic')).toBe('2026-04-11_08-00/basic');
  });

  it('handles deeply nested absolute paths', () => {
    expect(resolveSessionPath(outputDir, '/home/user/project/.demo-recordings/2026-04-11_08-00/basic')).toBe('2026-04-11_08-00/basic');
  });
});
