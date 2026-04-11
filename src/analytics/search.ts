/**
 * Recording search — full-text search across recording history
 * with scoring, highlighting, and grouping.
 *
 * Enables `demo-recorder search <query>` to find recordings by
 * scenario name, status, backend, session ID, or date range.
 */

import type { HistoryEntry } from './history.js';

/** A single search hit with relevance scoring. */
export interface SearchHit {
  /** The matched history entry. */
  readonly entry: HistoryEntry;
  /** Relevance score (higher = better match). */
  readonly score: number;
  /** Which fields matched. */
  readonly matchedFields: readonly string[];
}

/** Search result with metadata. */
export interface SearchResult {
  /** Query string used. */
  readonly query: string;
  /** Total entries searched. */
  readonly totalSearched: number;
  /** Matching hits sorted by relevance. */
  readonly hits: readonly SearchHit[];
  /** Unique scenarios in results. */
  readonly scenarioCount: number;
  /** Unique sessions in results. */
  readonly sessionCount: number;
}

/** Search options. */
export interface SearchOptions {
  /** Maximum number of results. */
  readonly limit?: number;
  /** Minimum score threshold (0-100). */
  readonly minScore?: number;
  /** Filter by status before searching. */
  readonly status?: string;
  /** Filter by backend before searching. */
  readonly backend?: string;
}

/**
 * Search recording history entries by a query string.
 *
 * Matches against scenario name, session ID, backend, and status.
 * Results are scored by relevance and sorted descending.
 */
export function searchHistory(
  entries: readonly HistoryEntry[],
  query: string,
  options: SearchOptions = {},
): SearchResult {
  const normalizedQuery = query.toLowerCase().trim();
  const terms = normalizedQuery.split(/\s+/).filter((t) => t.length > 0);

  if (terms.length === 0) {
    return {
      query,
      totalSearched: entries.length,
      hits: [],
      scenarioCount: 0,
      sessionCount: 0,
    };
  }

  // Pre-filter if status/backend specified
  let filtered: readonly HistoryEntry[] = entries;
  if (options.status) {
    const s = options.status.toLowerCase();
    filtered = filtered.filter((e) => e.status.toLowerCase() === s);
  }
  if (options.backend) {
    const b = options.backend.toLowerCase();
    filtered = filtered.filter((e) => e.backend.toLowerCase() === b);
  }

  const minScore = options.minScore ?? 10;
  const hits: SearchHit[] = [];

  for (const entry of filtered) {
    const { score, matchedFields } = scoreEntry(entry, terms);
    if (score >= minScore) {
      hits.push({ entry, score, matchedFields });
    }
  }

  // Sort by score descending, then by timestamp descending
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime();
  });

  // Apply limit
  const limited = options.limit && options.limit > 0 ? hits.slice(0, options.limit) : hits;

  const scenarios = new Set(limited.map((h) => h.entry.scenario));
  const sessions = new Set(limited.map((h) => h.entry.sessionId));

  return {
    query,
    totalSearched: entries.length,
    hits: limited,
    scenarioCount: scenarios.size,
    sessionCount: sessions.size,
  };
}

/**
 * Score a single entry against search terms.
 */
function scoreEntry(
  entry: HistoryEntry,
  terms: readonly string[],
): { score: number; matchedFields: string[] } {
  let totalScore = 0;
  const matchedFields = new Set<string>();

  const fields: Array<{ name: string; value: string; weight: number }> = [
    { name: 'scenario', value: entry.scenario, weight: 40 },
    { name: 'sessionId', value: entry.sessionId, weight: 20 },
    { name: 'backend', value: entry.backend, weight: 15 },
    { name: 'status', value: entry.status, weight: 15 },
    { name: 'timestamp', value: entry.timestamp, weight: 10 },
  ];

  for (const term of terms) {
    let termScore = 0;
    for (const field of fields) {
      const lower = field.value.toLowerCase();
      if (lower === term) {
        // Exact match
        termScore += field.weight;
        matchedFields.add(field.name);
      } else if (lower.includes(term)) {
        // Partial match — weighted by overlap ratio
        const ratio = term.length / lower.length;
        termScore += Math.round(field.weight * ratio * 0.7);
        matchedFields.add(field.name);
      }
    }
    totalScore += termScore;
  }

  // Normalize score to 0-100 based on number of terms
  const maxPossible = terms.length * 40; // max is scenario exact match per term
  const normalized = Math.min(100, Math.round((totalScore / maxPossible) * 100));

  return { score: normalized, matchedFields: Array.from(matchedFields) };
}

/**
 * Format search results as a human-readable report.
 */
export function formatSearchResults(result: SearchResult): string {
  const lines: string[] = [];

  lines.push('Search Results');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.hits.length === 0) {
    lines.push(`  No results found for "${result.query}"`);
    lines.push(`  Searched ${result.totalSearched} entries`);
    return lines.join('\n');
  }

  lines.push(`  Query: "${result.query}"`);
  lines.push(`  Found: ${result.hits.length} results (searched ${result.totalSearched})`);
  lines.push(`  Scenarios: ${result.scenarioCount}  Sessions: ${result.sessionCount}`);
  lines.push('');

  for (const hit of result.hits) {
    const e = hit.entry;
    const statusIcon = e.status === 'ok' ? '✓' : e.status === 'error' ? '✗' : '⚠';
    const ts = e.timestamp.slice(0, 19).replace('T', ' ');
    const fields = hit.matchedFields.join(', ');

    lines.push(`  ${statusIcon} ${e.scenario.padEnd(20)} ${ts}  score=${hit.score}  [${fields}]`);
    lines.push(`    Session: ${e.sessionId}  Backend: ${e.backend}  Duration: ${e.durationSeconds.toFixed(1)}s  Bugs: ${e.bugsFound}`);
  }

  lines.push('');
  return lines.join('\n');
}
