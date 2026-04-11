import { describe, it, expect } from 'vitest';
import { searchHistory, formatSearchResults } from '../src/analytics/search.js';
import type { HistoryEntry } from '../src/analytics/history.js';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-04-11T10:00:00.000Z',
    sessionId: '2026-04-11_10-00',
    scenario: 'basic',
    status: 'ok',
    durationSeconds: 12.5,
    bugsFound: 0,
    backend: 'vhs',
    ...overrides,
  };
}

const ENTRIES: HistoryEntry[] = [
  makeEntry({ scenario: 'login-flow', backend: 'browser', sessionId: '2026-04-11_08-00' }),
  makeEntry({ scenario: 'api-demo', backend: 'vhs', sessionId: '2026-04-11_09-00' }),
  makeEntry({ scenario: 'login-flow', status: 'error', bugsFound: 2, sessionId: '2026-04-11_10-00' }),
  makeEntry({ scenario: 'build-test', backend: 'vhs', sessionId: '2026-04-11_11-00' }),
  makeEntry({ scenario: 'deploy-check', status: 'warning', sessionId: '2026-04-11_12-00' }),
];

describe('searchHistory', () => {
  it('finds entries by scenario name', () => {
    const result = searchHistory(ENTRIES, 'login');
    expect(result.hits.length).toBe(2);
    expect(result.hits[0].entry.scenario).toBe('login-flow');
    expect(result.hits[0].matchedFields).toContain('scenario');
  });

  it('finds entries by backend', () => {
    const result = searchHistory(ENTRIES, 'browser');
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
    expect(result.hits[0].matchedFields).toContain('backend');
  });

  it('finds entries by status', () => {
    const result = searchHistory(ENTRIES, 'error');
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
    expect(result.hits[0].matchedFields).toContain('status');
  });

  it('finds entries by session ID', () => {
    const result = searchHistory(ENTRIES, '2026-04-11_08');
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
    expect(result.hits[0].matchedFields).toContain('sessionId');
  });

  it('returns empty for non-matching query', () => {
    const result = searchHistory(ENTRIES, 'nonexistent-xyz');
    expect(result.hits.length).toBe(0);
    expect(result.totalSearched).toBe(5);
  });

  it('returns empty for empty query', () => {
    const result = searchHistory(ENTRIES, '  ');
    expect(result.hits.length).toBe(0);
  });

  it('respects limit option', () => {
    const result = searchHistory(ENTRIES, 'login', { limit: 1 });
    expect(result.hits.length).toBe(1);
  });

  it('respects minScore option', () => {
    const result = searchHistory(ENTRIES, 'login', { minScore: 90 });
    // High minScore should filter out low-scoring partial matches
    for (const hit of result.hits) {
      expect(hit.score).toBeGreaterThanOrEqual(90);
    }
  });

  it('filters by status before searching', () => {
    const result = searchHistory(ENTRIES, 'login', { status: 'error' });
    expect(result.hits.length).toBe(1);
    expect(result.hits[0].entry.status).toBe('error');
  });

  it('filters by backend before searching', () => {
    const result = searchHistory(ENTRIES, 'login', { backend: 'browser' });
    expect(result.hits.length).toBe(1);
    expect(result.hits[0].entry.backend).toBe('browser');
  });

  it('scores exact matches higher than partial', () => {
    const result = searchHistory(ENTRIES, 'vhs');
    const exactHits = result.hits.filter((h) => h.entry.backend === 'vhs');
    expect(exactHits.length).toBeGreaterThanOrEqual(1);
    // Exact match on backend should score higher
    if (result.hits.length > 1) {
      expect(result.hits[0].score).toBeGreaterThanOrEqual(result.hits[result.hits.length - 1].score);
    }
  });

  it('counts unique scenarios and sessions', () => {
    const result = searchHistory(ENTRIES, 'login');
    expect(result.scenarioCount).toBe(1); // both are login-flow
    expect(result.sessionCount).toBe(2); // different sessions
  });

  it('handles multi-word queries', () => {
    const result = searchHistory(ENTRIES, 'login error');
    // Should match the entry that has both login and error
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
  });
});

describe('formatSearchResults', () => {
  it('formats results with hits', () => {
    const result = searchHistory(ENTRIES, 'login');
    const text = formatSearchResults(result);
    expect(text).toContain('Search Results');
    expect(text).toContain('login');
    expect(text).toContain('login-flow');
  });

  it('formats empty results', () => {
    const result = searchHistory(ENTRIES, 'nonexistent-xyz');
    const text = formatSearchResults(result);
    expect(text).toContain('No results found');
    expect(text).toContain('nonexistent-xyz');
  });

  it('shows score and matched fields', () => {
    const result = searchHistory(ENTRIES, 'login');
    const text = formatSearchResults(result);
    expect(text).toContain('score=');
    expect(text).toContain('scenario');
  });

  it('shows session and backend details', () => {
    const result = searchHistory(ENTRIES, 'login');
    const text = formatSearchResults(result);
    expect(text).toContain('Session:');
    expect(text).toContain('Backend:');
  });
});
