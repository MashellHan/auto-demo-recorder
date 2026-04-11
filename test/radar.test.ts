import { describe, it, expect } from 'vitest';
import { computeRadar, formatRadar, RADAR_DIMENSIONS } from '../src/analytics/radar.js';
import type { HistoryEntry } from '../src/analytics/history.js';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-04-11T10:00:00.000Z',
    sessionId: 's1',
    scenario: 'demo',
    status: 'ok',
    durationSeconds: 5,
    bugsFound: 0,
    backend: 'vhs',
    ...overrides,
  };
}

describe('computeRadar', () => {
  it('returns no-data for empty entries', () => {
    const result = computeRadar([]);
    expect(result.hasData).toBe(false);
    expect(result.profiles.length).toBe(0);
  });

  it('creates profiles for each scenario', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'a', timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ scenario: 'b', timestamp: '2026-04-11T11:00:00.000Z' }),
    ];
    const result = computeRadar(entries, now);
    expect(result.profiles.length).toBe(2);
  });

  it('each profile has 5 dimensions', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = computeRadar(entries, now);
    expect(result.profiles[0]!.values.length).toBe(5);
  });

  it('dimension names match RADAR_DIMENSIONS', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = computeRadar(entries, now);
    const dimNames = result.profiles[0]!.values.map((v) => v.dimension);
    expect(dimNames).toEqual([...RADAR_DIMENSIONS]);
  });

  it('all scores are between 0 and 100', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'a', timestamp: '2026-04-11T10:00:00.000Z', status: 'ok', durationSeconds: 3 }),
      makeEntry({ scenario: 'b', timestamp: '2026-04-10T10:00:00.000Z', status: 'error', durationSeconds: 10 }),
    ];
    const result = computeRadar(entries, now);
    for (const p of result.profiles) {
      for (const v of p.values) {
        expect(v.score).toBeGreaterThanOrEqual(0);
        expect(v.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('identifies best and worst scenarios', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      // 'good' has 100% success, recent, fast
      makeEntry({ scenario: 'good', timestamp: '2026-04-11T10:00:00.000Z', status: 'ok', durationSeconds: 2 }),
      makeEntry({ scenario: 'good', timestamp: '2026-04-11T11:00:00.000Z', status: 'ok', durationSeconds: 2 }),
      // 'bad' has 0% success, old, slow
      makeEntry({ scenario: 'bad', timestamp: '2026-03-01T10:00:00.000Z', status: 'error', durationSeconds: 100 }),
    ];
    const result = computeRadar(entries, now);
    expect(result.bestScenario).toBe('good');
    expect(result.worstScenario).toBe('bad');
  });

  it('profiles sorted by avgScore descending', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'top', timestamp: '2026-04-11T10:00:00.000Z', status: 'ok', durationSeconds: 1 }),
      makeEntry({ scenario: 'top', timestamp: '2026-04-11T11:00:00.000Z', status: 'ok', durationSeconds: 1 }),
      makeEntry({ scenario: 'mid', timestamp: '2026-04-10T10:00:00.000Z', status: 'ok', durationSeconds: 5 }),
      makeEntry({ scenario: 'low', timestamp: '2026-03-15T10:00:00.000Z', status: 'error', durationSeconds: 20 }),
    ];
    const result = computeRadar(entries, now);
    for (let i = 1; i < result.profiles.length; i++) {
      expect(result.profiles[i]!.avgScore).toBeLessThanOrEqual(result.profiles[i - 1]!.avgScore);
    }
  });

  it('single scenario gets all 100 scores', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [makeEntry({ timestamp: '2026-04-11T10:00:00.000Z' })];
    const result = computeRadar(entries, now);
    for (const v of result.profiles[0]!.values) {
      expect(v.score).toBe(100);
    }
  });

  it('computes avgScore correctly', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'a', timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ scenario: 'b', timestamp: '2026-04-10T10:00:00.000Z' }),
    ];
    const result = computeRadar(entries, now);
    for (const p of result.profiles) {
      const expectedAvg = p.values.reduce((s, v) => s + v.score, 0) / p.values.length;
      expect(p.avgScore).toBeCloseTo(expectedAvg, 1);
    }
  });

  it('success rate dimension reflects actual success', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'perfect', timestamp: '2026-04-11T10:00:00.000Z', status: 'ok' }),
      makeEntry({ scenario: 'failing', timestamp: '2026-04-11T10:00:00.000Z', status: 'error' }),
    ];
    const result = computeRadar(entries, now);
    const perfect = result.profiles.find((p) => p.scenario === 'perfect');
    const failing = result.profiles.find((p) => p.scenario === 'failing');
    const perfectSuccess = perfect!.values.find((v) => v.dimension === 'Success Rate');
    const failingSuccess = failing!.values.find((v) => v.dimension === 'Success Rate');
    expect(perfectSuccess!.score).toBeGreaterThan(failingSuccess!.score);
  });

  it('volume dimension reflects recording count', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'many', timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ scenario: 'many', timestamp: '2026-04-11T11:00:00.000Z' }),
      makeEntry({ scenario: 'many', timestamp: '2026-04-11T09:00:00.000Z' }),
      makeEntry({ scenario: 'few', timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = computeRadar(entries, now);
    const many = result.profiles.find((p) => p.scenario === 'many');
    const few = result.profiles.find((p) => p.scenario === 'few');
    const manyVol = many!.values.find((v) => v.dimension === 'Volume');
    const fewVol = few!.values.find((v) => v.dimension === 'Volume');
    expect(manyVol!.score).toBeGreaterThan(fewVol!.score);
  });

  it('speed dimension favors faster recordings', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'fast', timestamp: '2026-04-11T10:00:00.000Z', durationSeconds: 1 }),
      makeEntry({ scenario: 'slow', timestamp: '2026-04-11T10:00:00.000Z', durationSeconds: 100 }),
    ];
    const result = computeRadar(entries, now);
    const fast = result.profiles.find((p) => p.scenario === 'fast');
    const slow = result.profiles.find((p) => p.scenario === 'slow');
    const fastSpeed = fast!.values.find((v) => v.dimension === 'Speed');
    const slowSpeed = slow!.values.find((v) => v.dimension === 'Speed');
    expect(fastSpeed!.score).toBeGreaterThan(slowSpeed!.score);
  });

  it('returns total recordings count', () => {
    const entries = [
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
      makeEntry({ scenario: 'a' }),
    ];
    const result = computeRadar(entries);
    expect(result.totalRecordings).toBe(3);
  });

  it('dimensions list matches constant', () => {
    const result = computeRadar([makeEntry()]);
    expect(result.dimensions).toEqual([...RADAR_DIMENSIONS]);
  });
});

describe('formatRadar', () => {
  it('formats no-data result', () => {
    const result = computeRadar([]);
    const text = formatRadar(result);
    expect(text).toContain('Radar');
    expect(text).toContain('No recording data');
  });

  it('formats result with data', () => {
    const now = new Date('2026-04-11T12:00:00.000Z');
    const entries = [
      makeEntry({ scenario: 'a', timestamp: '2026-04-11T10:00:00.000Z' }),
      makeEntry({ scenario: 'b', timestamp: '2026-04-10T10:00:00.000Z' }),
    ];
    const result = computeRadar(entries, now);
    const text = formatRadar(result);
    expect(text).toContain('Radar');
    expect(text).toContain('Best');
    expect(text).toContain('Avg');
  });

  it('shows scenario names', () => {
    const entries = [
      makeEntry({ scenario: 'alpha' }),
      makeEntry({ scenario: 'beta' }),
    ];
    const result = computeRadar(entries);
    const text = formatRadar(result);
    expect(text).toContain('alpha');
    expect(text).toContain('beta');
  });
});
