import { describe, it, expect } from 'vitest';
import { computeScoreCard, formatScoreCard } from '../src/analytics/scorecard.js';
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

describe('computeScoreCard', () => {
  it('handles empty entries', () => {
    const card = computeScoreCard([]);
    expect(card.overallScore).toBe(0);
    expect(card.grade).toBe('N/A');
    expect(card.totalRecordings).toBe(0);
  });

  it('scores perfect recordings highly', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ scenario: `scenario-${i % 5}`, timestamp: `2026-04-11T1${i}:00:00.000Z` }),
    );
    const card = computeScoreCard(entries);
    expect(card.overallScore).toBeGreaterThanOrEqual(80);
    expect(card.grade).toMatch(/^[AB]$/);
  });

  it('penalizes high failure rate', () => {
    const entries = [
      makeEntry({ status: 'error' }),
      makeEntry({ status: 'error' }),
      makeEntry({ status: 'error' }),
      makeEntry({ status: 'ok' }),
    ];
    const card = computeScoreCard(entries);
    const successDim = card.dimensions.find((d) => d.name === 'Success Rate');
    expect(successDim).toBeDefined();
    expect(successDim!.score).toBeLessThanOrEqual(30);
  });

  it('penalizes high bug density', () => {
    const entries = [
      makeEntry({ bugsFound: 5 }),
      makeEntry({ bugsFound: 3 }),
    ];
    const card = computeScoreCard(entries);
    const bugDim = card.dimensions.find((d) => d.name === 'Bug Density');
    expect(bugDim).toBeDefined();
    expect(bugDim!.score).toBeLessThan(50);
  });

  it('rewards duration consistency', () => {
    const entries = [
      makeEntry({ durationSeconds: 10 }),
      makeEntry({ durationSeconds: 10.5 }),
      makeEntry({ durationSeconds: 10.2 }),
    ];
    const card = computeScoreCard(entries);
    const durDim = card.dimensions.find((d) => d.name === 'Duration Consistency');
    expect(durDim).toBeDefined();
    expect(durDim!.score).toBeGreaterThanOrEqual(90);
  });

  it('rewards scenario coverage', () => {
    const entries = [
      makeEntry({ scenario: 'a' }),
      makeEntry({ scenario: 'b' }),
      makeEntry({ scenario: 'c' }),
      makeEntry({ scenario: 'd' }),
      makeEntry({ scenario: 'e' }),
    ];
    const card = computeScoreCard(entries);
    const covDim = card.dimensions.find((d) => d.name === 'Scenario Coverage');
    expect(covDim).toBeDefined();
    expect(covDim!.score).toBe(100);
  });

  it('assigns correct grades', () => {
    // All ok, no bugs, consistent duration → high score
    const goodEntries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ scenario: `s-${i % 5}`, durationSeconds: 10, timestamp: `2026-04-11T1${i}:00:00.000Z` }),
    );
    const goodCard = computeScoreCard(goodEntries);
    expect(['A', 'B']).toContain(goodCard.grade);
  });

  it('has 5 dimensions', () => {
    const entries = [makeEntry()];
    const card = computeScoreCard(entries);
    expect(card.dimensions.length).toBe(5);
  });

  it('weights sum to approximately 1', () => {
    const entries = [makeEntry()];
    const card = computeScoreCard(entries);
    const totalWeight = card.dimensions.reduce((sum, d) => sum + d.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 1);
  });
});

describe('formatScoreCard', () => {
  it('formats empty card', () => {
    const card = computeScoreCard([]);
    const text = formatScoreCard(card);
    expect(text).toContain('No recordings');
  });

  it('formats card with data', () => {
    const entries = [makeEntry(), makeEntry({ scenario: 'other' })];
    const card = computeScoreCard(entries);
    const text = formatScoreCard(card);
    expect(text).toContain('Recording Score Card');
    expect(text).toContain('Overall:');
    expect(text).toContain('Dimensions:');
    expect(text).toContain('Success Rate');
    expect(text).toContain('Bug Density');
  });

  it('shows recording count', () => {
    const entries = [makeEntry(), makeEntry()];
    const card = computeScoreCard(entries);
    const text = formatScoreCard(card);
    expect(text).toContain('2 recordings');
  });
});
