/**
 * Recording score card — aggregate quality score from multiple
 * signals: success rate, duration consistency, bug density,
 * and scenario coverage.
 *
 * Produces a 0-100 quality score with per-dimension breakdowns.
 */

import type { HistoryEntry } from './history.js';

/** Score dimension with name and value. */
export interface ScoreDimension {
  /** Dimension name. */
  readonly name: string;
  /** Score (0-100). */
  readonly score: number;
  /** Weight (0-1). */
  readonly weight: number;
  /** Human-readable explanation. */
  readonly detail: string;
}

/** Score card result. */
export interface ScoreCard {
  /** Overall quality score (0-100). */
  readonly overallScore: number;
  /** Per-dimension breakdowns. */
  readonly dimensions: readonly ScoreDimension[];
  /** Grade letter. */
  readonly grade: string;
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
}

/**
 * Compute a quality score card from recording history.
 */
export function computeScoreCard(entries: readonly HistoryEntry[]): ScoreCard {
  if (entries.length === 0) {
    return {
      overallScore: 0,
      dimensions: [],
      grade: 'N/A',
      totalRecordings: 0,
    };
  }

  const dimensions: ScoreDimension[] = [
    scoreSuccessRate(entries),
    scoreBugDensity(entries),
    scoreDurationConsistency(entries),
    scoreScenarioCoverage(entries),
    scoreRecordingFrequency(entries),
  ];

  // Weighted average
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const weightedSum = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return {
    overallScore,
    dimensions,
    grade: scoreToGrade(overallScore),
    totalRecordings: entries.length,
  };
}

function scoreSuccessRate(entries: readonly HistoryEntry[]): ScoreDimension {
  const okCount = entries.filter((e) => e.status === 'ok').length;
  const rate = okCount / entries.length;
  const score = Math.round(rate * 100);

  return {
    name: 'Success Rate',
    score,
    weight: 0.35,
    detail: `${okCount}/${entries.length} recordings succeeded (${score}%)`,
  };
}

function scoreBugDensity(entries: readonly HistoryEntry[]): ScoreDimension {
  const totalBugs = entries.reduce((sum, e) => sum + e.bugsFound, 0);
  const avgBugs = totalBugs / entries.length;

  // 0 bugs = 100, 1 avg bug = 60, 3+ avg bugs = 0
  const score = Math.max(0, Math.round(100 - avgBugs * 33));

  return {
    name: 'Bug Density',
    score,
    weight: 0.25,
    detail: `${totalBugs} total bugs across ${entries.length} recordings (avg ${avgBugs.toFixed(1)})`,
  };
}

function scoreDurationConsistency(entries: readonly HistoryEntry[]): ScoreDimension {
  const durations = entries.map((e) => e.durationSeconds);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

  if (avg === 0) {
    return { name: 'Duration Consistency', score: 100, weight: 0.15, detail: 'No duration data' };
  }

  // Calculate coefficient of variation (CV)
  const variance = durations.reduce((sum, d) => sum + (d - avg) ** 2, 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / avg;

  // CV < 0.1 = 100, CV > 1.0 = 0
  const score = Math.max(0, Math.round(100 - cv * 100));

  return {
    name: 'Duration Consistency',
    score,
    weight: 0.15,
    detail: `Avg ${avg.toFixed(1)}s, StdDev ${stdDev.toFixed(1)}s (CV=${cv.toFixed(2)})`,
  };
}

function scoreScenarioCoverage(entries: readonly HistoryEntry[]): ScoreDimension {
  const scenarios = new Set(entries.map((e) => e.scenario));
  const count = scenarios.size;

  // More scenarios = better coverage, up to a point
  const score = Math.min(100, count * 20);

  return {
    name: 'Scenario Coverage',
    score,
    weight: 0.15,
    detail: `${count} unique scenarios recorded`,
  };
}

function scoreRecordingFrequency(entries: readonly HistoryEntry[]): ScoreDimension {
  if (entries.length < 2) {
    return { name: 'Recording Frequency', score: 50, weight: 0.10, detail: 'Not enough data' };
  }

  const timestamps = entries.map((e) => new Date(e.timestamp).getTime()).sort();
  const gaps: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    gaps.push(timestamps[i] - timestamps[i - 1]);
  }

  const avgGapHours = gaps.reduce((a, b) => a + b, 0) / gaps.length / (1000 * 60 * 60);

  // < 1 hour gap = 100, > 24 hour gap = 30
  const score = Math.max(30, Math.min(100, Math.round(100 - (avgGapHours - 1) * 3)));

  return {
    name: 'Recording Frequency',
    score,
    weight: 0.10,
    detail: `Avg gap between recordings: ${avgGapHours.toFixed(1)} hours`,
  };
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Format score card as a human-readable report.
 */
export function formatScoreCard(card: ScoreCard): string {
  const lines: string[] = [];
  lines.push('Recording Score Card');
  lines.push('═'.repeat(60));
  lines.push('');

  if (card.totalRecordings === 0) {
    lines.push('  No recordings to score.');
    return lines.join('\n');
  }

  // Overall score with grade
  const bar = '█'.repeat(Math.round(card.overallScore / 5));
  const empty = '░'.repeat(20 - Math.round(card.overallScore / 5));
  lines.push(`  Overall: ${bar}${empty} ${card.overallScore}/100 (${card.grade})`);
  lines.push('');

  // Dimension breakdown
  lines.push('  Dimensions:');
  for (const dim of card.dimensions) {
    const dimBar = '█'.repeat(Math.round(dim.score / 10));
    const dimEmpty = '░'.repeat(10 - Math.round(dim.score / 10));
    const weightPct = Math.round(dim.weight * 100);
    lines.push(`    ${dim.name.padEnd(24)} ${dimBar}${dimEmpty} ${dim.score}/100 (${weightPct}%)`);
    lines.push(`    ${''.padEnd(24)} ${dim.detail}`);
  }
  lines.push('');

  lines.push(`  Based on ${card.totalRecordings} recordings`);
  return lines.join('\n');
}
