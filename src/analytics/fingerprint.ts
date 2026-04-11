/**
 * Recording session fingerprinting — generates a deterministic fingerprint
 * for each session based on scenarios run, status patterns, and duration
 * buckets. Enables session comparison and near-duplicate detection.
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** Fingerprint for a single session. */
export interface SessionFingerprint {
  /** Session ID. */
  readonly sessionId: string;
  /** Fingerprint hash (hex string). */
  readonly hash: string;
  /** Number of recordings in the session. */
  readonly recordingCount: number;
  /** Scenarios included (sorted). */
  readonly scenarios: readonly string[];
  /** Status pattern (e.g., "ok,ok,error,ok"). */
  readonly statusPattern: string;
  /** Duration bucket pattern (e.g., "short,short,long"). */
  readonly durationPattern: string;
  /** Session timestamp (earliest recording). */
  readonly timestamp: string;
}

/** Similarity match between two sessions. */
export interface SimilarityMatch {
  /** First session ID. */
  readonly sessionA: string;
  /** Second session ID. */
  readonly sessionB: string;
  /** Similarity score (0-100). */
  readonly similarity: number;
  /** Whether fingerprints are identical. */
  readonly identical: boolean;
  /** Components that differ. */
  readonly differences: readonly string[];
}

/** Fingerprint analysis result. */
export interface FingerprintResult {
  /** All session fingerprints. */
  readonly fingerprints: readonly SessionFingerprint[];
  /** Identical session groups (sessions with same fingerprint). */
  readonly identicalGroups: readonly (readonly string[])[];
  /** Near-similar session pairs (similarity > threshold). */
  readonly similarPairs: readonly SimilarityMatch[];
  /** Total sessions. */
  readonly totalSessions: number;
  /** Unique fingerprints. */
  readonly uniqueFingerprints: number;
  /** Duplication rate (1 - unique/total). */
  readonly duplicationRate: number;
}

/**
 * Generate fingerprints for all sessions and find duplicates/similarities.
 *
 * @param entries Recording history entries.
 * @param similarityThreshold Minimum similarity to report (default: 80).
 */
export function fingerprintSessions(
  entries: readonly HistoryEntry[],
  similarityThreshold = 80,
): FingerprintResult {
  if (entries.length === 0) {
    return {
      fingerprints: [],
      identicalGroups: [],
      similarPairs: [],
      totalSessions: 0,
      uniqueFingerprints: 0,
      duplicationRate: 0,
    };
  }

  // Group entries by sessionId
  const sessionMap = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const arr = sessionMap.get(e.sessionId) ?? [];
    arr.push(e);
    sessionMap.set(e.sessionId, arr);
  }

  // Generate fingerprints
  const fingerprints: SessionFingerprint[] = [];
  for (const [sessionId, sessionEntries] of sessionMap) {
    const sorted = [...sessionEntries].sort((a, b) => a.scenario.localeCompare(b.scenario));
    const scenarios = [...new Set(sorted.map((e) => e.scenario))].sort();
    const statusPattern = sorted.map((e) => e.status).join(',');
    const durationPattern = sorted.map((e) => durationBucket(e.durationSeconds)).join(',');

    const hashInput = `${scenarios.join('|')}::${statusPattern}::${durationPattern}`;
    const hash = simpleHash(hashInput);

    const timestamps = sessionEntries.map((e) => e.timestamp);
    const earliest = timestamps.sort()[0];

    fingerprints.push({
      sessionId,
      hash,
      recordingCount: sessionEntries.length,
      scenarios,
      statusPattern,
      durationPattern,
      timestamp: earliest,
    });
  }

  // Sort by timestamp
  fingerprints.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Find identical groups
  const hashGroups = new Map<string, string[]>();
  for (const fp of fingerprints) {
    const arr = hashGroups.get(fp.hash) ?? [];
    arr.push(fp.sessionId);
    hashGroups.set(fp.hash, arr);
  }
  const identicalGroups = [...hashGroups.values()].filter((g) => g.length > 1);

  // Find similar pairs (brute force — session count is typically small)
  const similarPairs: SimilarityMatch[] = [];
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const a = fingerprints[i];
      const b = fingerprints[j];
      if (a.hash === b.hash) continue; // Already in identical groups
      const sim = computeSimilarity(a, b);
      if (sim.similarity >= similarityThreshold) {
        similarPairs.push(sim);
      }
    }
  }

  similarPairs.sort((a, b) => b.similarity - a.similarity);

  const uniqueFingerprints = hashGroups.size;
  const totalSessions = fingerprints.length;
  const duplicationRate = totalSessions > 0
    ? round2((1 - uniqueFingerprints / totalSessions) * 100)
    : 0;

  return {
    fingerprints,
    identicalGroups,
    similarPairs,
    totalSessions,
    uniqueFingerprints,
    duplicationRate,
  };
}

function durationBucket(seconds: number): string {
  if (seconds < 3) return 'instant';
  if (seconds < 10) return 'short';
  if (seconds < 30) return 'medium';
  if (seconds < 120) return 'long';
  return 'very-long';
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function computeSimilarity(a: SessionFingerprint, b: SessionFingerprint): SimilarityMatch {
  const differences: string[] = [];
  let score = 0;
  const weights = { scenarios: 40, status: 30, duration: 20, count: 10 };

  // Scenario overlap (Jaccard similarity)
  const setA = new Set(a.scenarios);
  const setB = new Set(b.scenarios);
  const intersection = a.scenarios.filter((s) => setB.has(s)).length;
  const union = new Set([...a.scenarios, ...b.scenarios]).size;
  const scenarioSim = union > 0 ? (intersection / union) * weights.scenarios : weights.scenarios;
  score += scenarioSim;
  if (intersection < union) differences.push('scenarios');

  // Status pattern similarity
  const statusA = a.statusPattern.split(',');
  const statusB = b.statusPattern.split(',');
  const maxLen = Math.max(statusA.length, statusB.length);
  if (maxLen > 0) {
    const matches = Math.min(statusA.length, statusB.length);
    let statusMatch = 0;
    for (let i = 0; i < matches; i++) {
      if (statusA[i] === statusB[i]) statusMatch++;
    }
    const statusSim = (statusMatch / maxLen) * weights.status;
    score += statusSim;
    if (statusMatch < maxLen) differences.push('status');
  } else {
    score += weights.status;
  }

  // Duration pattern similarity
  const durA = a.durationPattern.split(',');
  const durB = b.durationPattern.split(',');
  const maxDurLen = Math.max(durA.length, durB.length);
  if (maxDurLen > 0) {
    const durMatches = Math.min(durA.length, durB.length);
    let durMatch = 0;
    for (let i = 0; i < durMatches; i++) {
      if (durA[i] === durB[i]) durMatch++;
    }
    const durSim = (durMatch / maxDurLen) * weights.duration;
    score += durSim;
    if (durMatch < maxDurLen) differences.push('duration');
  } else {
    score += weights.duration;
  }

  // Recording count similarity
  const countRatio = Math.min(a.recordingCount, b.recordingCount) / Math.max(a.recordingCount, b.recordingCount);
  score += countRatio * weights.count;
  if (a.recordingCount !== b.recordingCount) differences.push('count');

  return {
    sessionA: a.sessionId,
    sessionB: b.sessionId,
    similarity: round2(score),
    identical: a.hash === b.hash,
    differences,
  };
}

/**
 * Format fingerprint analysis report.
 */
export function formatFingerprints(result: FingerprintResult): string {
  const lines: string[] = [];
  lines.push('Session Fingerprinting');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalSessions === 0) {
    lines.push('  No sessions to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Total sessions:       ${result.totalSessions}`);
  lines.push(`  Unique fingerprints:  ${result.uniqueFingerprints}`);
  lines.push(`  Duplication rate:     ${result.duplicationRate}%`);
  lines.push('');

  if (result.identicalGroups.length > 0) {
    lines.push(`  Identical session groups (${result.identicalGroups.length}):`);
    for (const group of result.identicalGroups) {
      lines.push(`    ${group.join(', ')}`);
    }
    lines.push('');
  }

  if (result.similarPairs.length > 0) {
    lines.push(`  Similar sessions (${result.similarPairs.length}):`);
    for (const pair of result.similarPairs.slice(0, 10)) {
      lines.push(
        `    ${pair.sessionA} ↔ ${pair.sessionB}  ${pair.similarity}%  [diff: ${pair.differences.join(', ')}]`,
      );
    }
    if (result.similarPairs.length > 10) {
      lines.push(`    ... and ${result.similarPairs.length - 10} more`);
    }
    lines.push('');
  }

  lines.push('  Session fingerprints:');
  for (const fp of result.fingerprints.slice(0, 20)) {
    lines.push(
      `    ${fp.sessionId.padEnd(25)} ${fp.hash}  ${fp.recordingCount} rec  ${fp.scenarios.length} scenarios`,
    );
  }
  if (result.fingerprints.length > 20) {
    lines.push(`    ... and ${result.fingerprints.length - 20} more`);
  }

  lines.push('');
  return lines.join('\n');
}
