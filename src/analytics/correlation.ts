/**
 * Recording correlation matrix — analyze relationships between
 * scenario outcomes to identify scenarios that tend to fail or
 * succeed together.
 *
 * Uses Pearson correlation coefficient on per-session binary
 * success/failure vectors.
 */

import type { HistoryEntry } from './history.js';

/** A correlation pair between two scenarios. */
export interface CorrelationPair {
  /** First scenario name. */
  readonly scenarioA: string;
  /** Second scenario name. */
  readonly scenarioB: string;
  /** Pearson correlation coefficient (-1 to 1). */
  readonly correlation: number;
  /** Number of shared sessions used for calculation. */
  readonly sharedSessions: number;
  /** Interpretation. */
  readonly strength: 'strong-positive' | 'moderate-positive' | 'weak' | 'moderate-negative' | 'strong-negative';
}

/** Correlation analysis result. */
export interface CorrelationResult {
  /** All scenario pairs with their correlations. */
  readonly pairs: readonly CorrelationPair[];
  /** Unique scenario names. */
  readonly scenarios: readonly string[];
  /** Total sessions analyzed. */
  readonly totalSessions: number;
  /** Minimum shared sessions required for correlation (default 3). */
  readonly minSharedSessions: number;
}

/**
 * Classify correlation strength.
 */
function classifyStrength(r: number): CorrelationPair['strength'] {
  const abs = Math.abs(r);
  if (abs >= 0.7) return r > 0 ? 'strong-positive' : 'strong-negative';
  if (abs >= 0.4) return r > 0 ? 'moderate-positive' : 'moderate-negative';
  return 'weak';
}

/**
 * Compute Pearson correlation coefficient between two arrays.
 */
function pearsonCorrelation(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n === 0) return 0;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;
  return num / denom;
}

/**
 * Analyze correlations between scenario outcomes.
 *
 * Groups entries by session, builds binary success vectors per scenario,
 * and computes Pearson correlation for each pair.
 *
 * @param entries - Recording history entries.
 * @param minSessions - Minimum shared sessions required (default 3).
 */
export function computeCorrelations(
  entries: readonly HistoryEntry[],
  minSessions: number = 3,
): CorrelationResult {
  // Group entries by session
  const sessions = new Map<string, Map<string, boolean>>();
  const scenarioSet = new Set<string>();

  for (const entry of entries) {
    scenarioSet.add(entry.scenario);
    let session = sessions.get(entry.sessionId);
    if (!session) {
      session = new Map();
      sessions.set(entry.sessionId, session);
    }
    // Use latest status per scenario per session
    session.set(entry.scenario, entry.status === 'ok');
  }

  const scenarios = [...scenarioSet].sort();
  const pairs: CorrelationPair[] = [];

  // Compute correlation for each unique pair
  for (let i = 0; i < scenarios.length; i++) {
    for (let j = i + 1; j < scenarios.length; j++) {
      const a = scenarios[i];
      const b = scenarios[j];

      // Build aligned vectors for sessions that have both scenarios
      const xs: number[] = [];
      const ys: number[] = [];

      for (const session of sessions.values()) {
        if (session.has(a) && session.has(b)) {
          xs.push(session.get(a)! ? 1 : 0);
          ys.push(session.get(b)! ? 1 : 0);
        }
      }

      if (xs.length >= minSessions) {
        const correlation = pearsonCorrelation(xs, ys);
        pairs.push({
          scenarioA: a,
          scenarioB: b,
          correlation,
          sharedSessions: xs.length,
          strength: classifyStrength(correlation),
        });
      }
    }
  }

  // Sort by absolute correlation descending
  pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return {
    pairs,
    scenarios,
    totalSessions: sessions.size,
    minSharedSessions: minSessions,
  };
}

/**
 * Format correlation analysis results.
 */
export function formatCorrelations(result: CorrelationResult): string {
  const lines: string[] = [];
  lines.push('Scenario Correlation Matrix');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.pairs.length === 0) {
    lines.push('  Insufficient data for correlation analysis.');
    lines.push(`  Need at least ${result.minSharedSessions} shared sessions between scenario pairs.`);
    lines.push(`  Scenarios: ${result.scenarios.length}, Sessions: ${result.totalSessions}`);
    return lines.join('\n');
  }

  // Show strongest correlations first
  const significant = result.pairs.filter((p) => p.strength !== 'weak');

  if (significant.length > 0) {
    lines.push('  Significant Correlations:');
    lines.push('');
    for (const p of significant) {
      const icon = p.correlation > 0 ? '↑↑' : '↑↓';
      const label = p.strength.replace('-', ' ');
      lines.push(`  ${icon} ${p.scenarioA} ↔ ${p.scenarioB}`);
      lines.push(`     r=${p.correlation.toFixed(3)} (${label}, ${p.sharedSessions} sessions)`);
    }
    lines.push('');
  }

  const weak = result.pairs.filter((p) => p.strength === 'weak');
  if (weak.length > 0) {
    lines.push(`  Weak/No Correlation: ${weak.length} pair(s)`);
  }

  lines.push('');
  lines.push(`  Total: ${result.scenarios.length} scenarios, ${result.totalSessions} sessions, ${result.pairs.length} pairs analyzed`);
  return lines.join('\n');
}
