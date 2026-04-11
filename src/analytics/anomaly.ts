/**
 * Recording anomaly detector — identifies statistically abnormal recordings
 * using Z-score analysis on duration and per-scenario deviation tracking.
 */

import type { HistoryEntry } from './history.js';
import { round2 } from './utils.js';

/** Anomaly type classification. */
export type AnomalyType = 'duration' | 'burst' | 'gap';

/** Severity of an anomaly. */
export type AnomalySeverity = 'high' | 'medium' | 'low';

/** A single detected anomaly. */
export interface Anomaly {
  /** Anomaly type. */
  readonly type: AnomalyType;
  /** Severity level. */
  readonly severity: AnomalySeverity;
  /** Affected scenario. */
  readonly scenario: string;
  /** Timestamp of the anomalous recording. */
  readonly timestamp: string;
  /** The anomalous value. */
  readonly value: number;
  /** Expected value (mean). */
  readonly expected: number;
  /** Z-score (absolute). */
  readonly zScore: number;
  /** Human-readable description. */
  readonly description: string;
}

/** Anomaly detection result. */
export interface AnomalyResult {
  /** All detected anomalies, sorted by severity then timestamp. */
  readonly anomalies: readonly Anomaly[];
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
  /** Number of scenarios analyzed. */
  readonly scenarioCount: number;
  /** Anomaly rate (anomalies / total recordings). */
  readonly anomalyRate: number;
  /** Count by severity. */
  readonly bySeverity: { readonly high: number; readonly medium: number; readonly low: number };
  /** Count by type. */
  readonly byType: { readonly duration: number; readonly burst: number; readonly gap: number };
}

/**
 * Detect recording anomalies.
 *
 * @param entries Recording history entries.
 * @param zThreshold Z-score threshold for flagging anomalies (default: 2.0).
 */
export function detectAnomalies(
  entries: readonly HistoryEntry[],
  zThreshold = 2.0,
): AnomalyResult {
  if (entries.length === 0) {
    return {
      anomalies: [],
      totalRecordings: 0,
      scenarioCount: 0,
      anomalyRate: 0,
      bySeverity: { high: 0, medium: 0, low: 0 },
      byType: { duration: 0, burst: 0, gap: 0 },
    };
  }

  const anomalies: Anomaly[] = [];

  // Group by scenario
  const scenarioMap = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const arr = scenarioMap.get(e.scenario) ?? [];
    arr.push(e);
    scenarioMap.set(e.scenario, arr);
  }

  // 1. Duration anomalies per scenario
  for (const [scenario, scenarioEntries] of scenarioMap) {
    if (scenarioEntries.length < 3) continue; // Need enough data for stats

    const durations = scenarioEntries.map((e) => e.durationSeconds);
    const mean = durations.reduce((s, d) => s + d, 0) / durations.length;
    const stdDev = Math.sqrt(
      durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length,
    );

    if (stdDev === 0) continue; // No variance

    for (const entry of scenarioEntries) {
      const z = Math.abs((entry.durationSeconds - mean) / stdDev);
      if (z >= zThreshold) {
        const severity = classifySeverity(z, zThreshold);
        const direction = entry.durationSeconds > mean ? 'longer' : 'shorter';
        anomalies.push({
          type: 'duration',
          severity,
          scenario,
          timestamp: entry.timestamp,
          value: round2(entry.durationSeconds),
          expected: round2(mean),
          zScore: round2(z),
          description: `${scenario}: ${round2(entry.durationSeconds)}s is ${direction} than expected ${round2(mean)}s (z=${round2(z)})`,
        });
      }
    }
  }

  // 2. Burst detection — unusually many recordings in a short window
  for (const [scenario, scenarioEntries] of scenarioMap) {
    if (scenarioEntries.length < 5) continue;

    const sorted = [...scenarioEntries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Count recordings per hour
    const hourBuckets = new Map<string, number>();
    for (const e of sorted) {
      const hour = e.timestamp.slice(0, 13); // YYYY-MM-DDTHH
      hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);
    }

    const counts = [...hourBuckets.values()];
    if (counts.length < 3) continue;

    const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
    const stdDev = Math.sqrt(
      counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length,
    );

    if (stdDev === 0) continue;

    for (const [hour, count] of hourBuckets) {
      const z = (count - mean) / stdDev;
      if (z >= zThreshold) {
        const severity = classifySeverity(z, zThreshold);
        anomalies.push({
          type: 'burst',
          severity,
          scenario,
          timestamp: `${hour}:00:00.000Z`,
          value: count,
          expected: round2(mean),
          zScore: round2(z),
          description: `${scenario}: ${count} recordings in 1 hour (expected ~${round2(mean)}, z=${round2(z)})`,
        });
      }
    }
  }

  // 3. Gap detection — unusually long periods between recordings
  for (const [scenario, scenarioEntries] of scenarioMap) {
    if (scenarioEntries.length < 4) continue;

    const sorted = [...scenarioEntries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const gaps: Array<{ hours: number; afterTimestamp: string }> = [];
    for (let i = 1; i < sorted.length; i++) {
      const gapMs = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime();
      gaps.push({ hours: gapMs / (1000 * 60 * 60), afterTimestamp: sorted[i - 1].timestamp });
    }

    const gapValues = gaps.map((g) => g.hours);
    const mean = gapValues.reduce((s, g) => s + g, 0) / gapValues.length;
    const stdDev = Math.sqrt(
      gapValues.reduce((s, g) => s + (g - mean) ** 2, 0) / gapValues.length,
    );

    if (stdDev === 0) continue;

    for (const gap of gaps) {
      const z = (gap.hours - mean) / stdDev;
      if (z >= zThreshold) {
        const severity = classifySeverity(z, zThreshold);
        anomalies.push({
          type: 'gap',
          severity,
          scenario,
          timestamp: gap.afterTimestamp,
          value: round2(gap.hours),
          expected: round2(mean),
          zScore: round2(z),
          description: `${scenario}: ${round2(gap.hours)}h gap (expected ~${round2(mean)}h, z=${round2(z)})`,
        });
      }
    }
  }

  // Sort by severity then timestamp
  const severityOrder: Record<AnomalySeverity, number> = { high: 0, medium: 1, low: 2 };
  anomalies.sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity]
    || a.timestamp.localeCompare(b.timestamp),
  );

  const bySeverity = {
    high: anomalies.filter((a) => a.severity === 'high').length,
    medium: anomalies.filter((a) => a.severity === 'medium').length,
    low: anomalies.filter((a) => a.severity === 'low').length,
  };

  const byType = {
    duration: anomalies.filter((a) => a.type === 'duration').length,
    burst: anomalies.filter((a) => a.type === 'burst').length,
    gap: anomalies.filter((a) => a.type === 'gap').length,
  };

  return {
    anomalies,
    totalRecordings: entries.length,
    scenarioCount: scenarioMap.size,
    anomalyRate: round2((anomalies.length / entries.length) * 100),
    bySeverity,
    byType,
  };
}

function classifySeverity(z: number, threshold: number): AnomalySeverity {
  if (z >= threshold * 2) return 'high';
  if (z >= threshold * 1.5) return 'medium';
  return 'low';
}

/**
 * Format anomaly detection report.
 */
export function formatAnomalies(result: AnomalyResult): string {
  const lines: string[] = [];
  const severityIcons: Record<AnomalySeverity, string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };
  const typeIcons: Record<AnomalyType, string> = {
    duration: '⏱',
    burst: '💥',
    gap: '⏸',
  };

  lines.push('Recording Anomaly Detection');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Recordings analyzed: ${result.totalRecordings}`);
  lines.push(`  Scenarios:           ${result.scenarioCount}`);
  lines.push(`  Anomalies found:     ${result.anomalies.length}`);
  lines.push(`  Anomaly rate:        ${result.anomalyRate}%`);
  lines.push('');

  if (result.anomalies.length > 0) {
    lines.push(`  By severity:  🔴 ${result.bySeverity.high}  🟡 ${result.bySeverity.medium}  🟢 ${result.bySeverity.low}`);
    lines.push(`  By type:      ⏱ ${result.byType.duration}  💥 ${result.byType.burst}  ⏸ ${result.byType.gap}`);
    lines.push('');
    lines.push('  Details:');
    for (const a of result.anomalies) {
      lines.push(`    ${severityIcons[a.severity]} ${typeIcons[a.type]} ${a.description}`);
    }
  } else {
    lines.push('  No anomalies detected.');
  }

  lines.push('');
  return lines.join('\n');
}
