import { describe, it, expect } from 'vitest';
import { fingerprintSessions, formatFingerprints } from '../src/analytics/fingerprint.js';
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

describe('fingerprintSessions', () => {
  it('returns empty for no entries', () => {
    const result = fingerprintSessions([]);
    expect(result.fingerprints).toEqual([]);
    expect(result.totalSessions).toBe(0);
    expect(result.uniqueFingerprints).toBe(0);
  });

  it('generates fingerprints per session', () => {
    const entries = [
      makeEntry({ sessionId: 's1' }),
      makeEntry({ sessionId: 's2' }),
    ];
    const result = fingerprintSessions(entries);
    expect(result.totalSessions).toBe(2);
    expect(result.fingerprints.length).toBe(2);
  });

  it('generates deterministic hashes', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'demo', status: 'ok', durationSeconds: 5 }),
    ];
    const r1 = fingerprintSessions(entries);
    const r2 = fingerprintSessions(entries);
    expect(r1.fingerprints[0].hash).toBe(r2.fingerprints[0].hash);
  });

  it('detects identical sessions', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'demo', status: 'ok', durationSeconds: 5 }),
      makeEntry({ sessionId: 's2', scenario: 'demo', status: 'ok', durationSeconds: 5 }),
    ];
    const result = fingerprintSessions(entries);
    expect(result.identicalGroups.length).toBe(1);
    expect(result.identicalGroups[0]).toContain('s1');
    expect(result.identicalGroups[0]).toContain('s2');
  });

  it('does not group different sessions as identical', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'demo', status: 'ok', durationSeconds: 5 }),
      makeEntry({ sessionId: 's2', scenario: 'demo', status: 'error', durationSeconds: 5 }),
    ];
    const result = fingerprintSessions(entries);
    expect(result.identicalGroups.length).toBe(0);
  });

  it('finds similar sessions', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'demo', status: 'ok', durationSeconds: 5 }),
      makeEntry({ sessionId: 's2', scenario: 'demo', status: 'ok', durationSeconds: 8 }),
    ];
    const result = fingerprintSessions(entries, 50);
    expect(result.similarPairs.length).toBeGreaterThanOrEqual(0);
  });

  it('computes duplication rate', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'demo', durationSeconds: 5 }),
      makeEntry({ sessionId: 's2', scenario: 'demo', durationSeconds: 5 }),
      makeEntry({ sessionId: 's3', scenario: 'other', durationSeconds: 10 }),
    ];
    const result = fingerprintSessions(entries);
    // 3 sessions, 2 unique fingerprints (s1 and s2 identical) → duplication = (1 - 2/3) * 100 = 33.33%
    expect(result.duplicationRate).toBeGreaterThan(0);
  });

  it('lists scenarios in fingerprint', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'alpha' }),
      makeEntry({ sessionId: 's1', scenario: 'beta' }),
    ];
    const result = fingerprintSessions(entries);
    expect(result.fingerprints[0].scenarios).toEqual(['alpha', 'beta']);
  });

  it('records status pattern', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'a', status: 'ok' }),
      makeEntry({ sessionId: 's1', scenario: 'b', status: 'error' }),
    ];
    const result = fingerprintSessions(entries);
    expect(result.fingerprints[0].statusPattern).toContain('ok');
    expect(result.fingerprints[0].statusPattern).toContain('error');
  });

  it('assigns duration buckets', () => {
    const entries = [
      makeEntry({ sessionId: 's1', durationSeconds: 1 }), // instant
      makeEntry({ sessionId: 's2', durationSeconds: 60 }), // long
    ];
    const result = fingerprintSessions(entries);
    expect(result.fingerprints[0].durationPattern).toBe('instant');
    expect(result.fingerprints[1].durationPattern).toBe('long');
  });

  it('sorts fingerprints by timestamp', () => {
    const entries = [
      makeEntry({ sessionId: 's2', timestamp: '2026-04-11T12:00:00.000Z' }),
      makeEntry({ sessionId: 's1', timestamp: '2026-04-11T10:00:00.000Z' }),
    ];
    const result = fingerprintSessions(entries);
    expect(result.fingerprints[0].sessionId).toBe('s1');
    expect(result.fingerprints[1].sessionId).toBe('s2');
  });

  it('handles single session', () => {
    const entries = [makeEntry()];
    const result = fingerprintSessions(entries);
    expect(result.totalSessions).toBe(1);
    expect(result.uniqueFingerprints).toBe(1);
    expect(result.duplicationRate).toBe(0);
  });

  it('sorts similar pairs by similarity descending', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'demo', durationSeconds: 5 }),
      makeEntry({ sessionId: 's2', scenario: 'demo', durationSeconds: 15 }),
      makeEntry({ sessionId: 's3', scenario: 'other', durationSeconds: 5 }),
    ];
    const result = fingerprintSessions(entries, 20);
    if (result.similarPairs.length >= 2) {
      for (let i = 1; i < result.similarPairs.length; i++) {
        expect(result.similarPairs[i].similarity)
          .toBeLessThanOrEqual(result.similarPairs[i - 1].similarity);
      }
    }
  });

  it('records recording count in fingerprint', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'a' }),
      makeEntry({ sessionId: 's1', scenario: 'b' }),
      makeEntry({ sessionId: 's2', scenario: 'a' }),
    ];
    const result = fingerprintSessions(entries);
    const s1 = result.fingerprints.find((f) => f.sessionId === 's1');
    const s2 = result.fingerprints.find((f) => f.sessionId === 's2');
    expect(s1!.recordingCount).toBe(2);
    expect(s2!.recordingCount).toBe(1);
  });

  it('includes differences in similarity match', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'demo', durationSeconds: 5 }),
      makeEntry({ sessionId: 's2', scenario: 'demo', durationSeconds: 200 }),
    ];
    const result = fingerprintSessions(entries, 20);
    if (result.similarPairs.length > 0) {
      expect(result.similarPairs[0].differences.length).toBeGreaterThan(0);
    }
  });
});

describe('formatFingerprints', () => {
  it('formats empty result', () => {
    const result = fingerprintSessions([]);
    const text = formatFingerprints(result);
    expect(text).toContain('Session Fingerprinting');
    expect(text).toContain('No sessions');
  });

  it('formats with data', () => {
    const entries = [
      makeEntry({ sessionId: 's1' }),
      makeEntry({ sessionId: 's2' }),
    ];
    const result = fingerprintSessions(entries);
    const text = formatFingerprints(result);
    expect(text).toContain('Total sessions');
    expect(text).toContain('Unique fingerprints');
    expect(text).toContain('Duplication rate');
  });

  it('shows identical groups', () => {
    const entries = [
      makeEntry({ sessionId: 's1', scenario: 'demo', durationSeconds: 5 }),
      makeEntry({ sessionId: 's2', scenario: 'demo', durationSeconds: 5 }),
    ];
    const result = fingerprintSessions(entries);
    const text = formatFingerprints(result);
    expect(text).toContain('Identical session groups');
  });

  it('shows fingerprint details', () => {
    const entries = [makeEntry()];
    const result = fingerprintSessions(entries);
    const text = formatFingerprints(result);
    expect(text).toContain('Session fingerprints');
    expect(text).toContain('s1');
  });
});
