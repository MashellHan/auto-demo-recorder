import { readdir, readFile, stat, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { Report } from '../pipeline/regression.js';

export interface RecordingStats {
  /** Total number of recordings across all sessions. */
  totalRecordings: number;
  /** Unique scenario names recorded. */
  uniqueScenarios: string[];
  /** Total recording duration in seconds. */
  totalDurationSeconds: number;
  /** Total bugs found across all recordings. */
  totalBugs: number;
  /** Total regressions detected. */
  totalRegressions: number;
  /** Most recorded scenario name. */
  mostRecordedScenario: string;
  /** Number of times the most recorded scenario was recorded. */
  mostRecordedCount: number;
  /** Quality trend over the last N recordings (error count per recording). */
  qualityTrend: QualityDataPoint[];
  /** Timestamp of the earliest recording. */
  firstRecording: string;
  /** Timestamp of the most recent recording. */
  lastRecording: string;
}

export interface QualityDataPoint {
  /** Session timestamp. */
  timestamp: string;
  /** Scenario name. */
  scenario: string;
  /** Number of bugs in this recording. */
  bugs: number;
  /** Overall status. */
  status: string;
}

/**
 * Scan a recording output directory and compute project-wide statistics.
 * Reads all report.json files from timestamped session directories.
 */
export async function computeStats(outputDir: string): Promise<RecordingStats> {
  if (!existsSync(outputDir)) {
    return emptyStats();
  }

  const entries = await readdir(outputDir, { withFileTypes: true });
  const reports: Array<Report & { _sessionTimestamp: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'latest') continue;

    const sessionDir = join(outputDir, entry.name);
    const scenarioDirs = await readdir(sessionDir, { withFileTypes: true });

    for (const sd of scenarioDirs) {
      if (!sd.isDirectory()) continue;
      const reportPath = join(sessionDir, sd.name, 'report.json');
      if (!existsSync(reportPath)) continue;

      try {
        const content = await readFile(reportPath, 'utf-8');
        const report = JSON.parse(content) as Report;
        reports.push({ ...report, _sessionTimestamp: entry.name });
      } catch {
        // Skip malformed reports
      }
    }
  }

  if (reports.length === 0) {
    return emptyStats();
  }

  // Compute scenario frequency
  const scenarioCounts = new Map<string, number>();
  for (const r of reports) {
    scenarioCounts.set(r.scenario, (scenarioCounts.get(r.scenario) ?? 0) + 1);
  }

  const uniqueScenarios = [...scenarioCounts.keys()];
  let mostRecordedScenario = '';
  let mostRecordedCount = 0;
  for (const [name, count] of scenarioCounts) {
    if (count > mostRecordedCount) {
      mostRecordedScenario = name;
      mostRecordedCount = count;
    }
  }

  // Sort reports by timestamp for trend
  const sorted = [...reports].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const qualityTrend: QualityDataPoint[] = sorted.slice(-10).map((r) => ({
    timestamp: r._sessionTimestamp,
    scenario: r.scenario,
    bugs: r.bugs_found,
    status: r.overall_status,
  }));

  const totalDurationSeconds = reports.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0);
  const totalBugs = reports.reduce((sum, r) => sum + (r.bugs_found ?? 0), 0);
  const totalRegressions = reports.filter(
    (r) => r.overall_status === 'error' || r.overall_status === 'warning',
  ).length;

  return {
    totalRecordings: reports.length,
    uniqueScenarios,
    totalDurationSeconds,
    totalBugs,
    totalRegressions,
    mostRecordedScenario,
    mostRecordedCount,
    qualityTrend,
    firstRecording: sorted[0].timestamp,
    lastRecording: sorted[sorted.length - 1].timestamp,
  };
}

/**
 * Format recording stats as a human-readable summary.
 */
export function formatStats(stats: RecordingStats): string {
  const lines: string[] = [];

  if (stats.totalRecordings === 0) {
    lines.push('No recordings found.');
    return lines.join('\n');
  }

  lines.push(`Recording Statistics`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`Total recordings: ${stats.totalRecordings}`);
  lines.push(`Unique scenarios: ${stats.uniqueScenarios.length}`);
  lines.push(`Total duration: ${formatDuration(stats.totalDurationSeconds)}`);
  lines.push(`Bugs detected: ${stats.totalBugs}`);
  lines.push(`Regressions found: ${stats.totalRegressions}`);
  lines.push('');

  if (stats.mostRecordedScenario) {
    lines.push(`Most recorded: ${stats.mostRecordedScenario} (${stats.mostRecordedCount} runs)`);
  }

  if (stats.firstRecording) {
    lines.push(`First recording: ${stats.firstRecording}`);
    lines.push(`Last recording: ${stats.lastRecording}`);
  }

  if (stats.qualityTrend.length > 0) {
    lines.push('');
    lines.push('Quality Trend (last 10):');
    for (const dp of stats.qualityTrend) {
      const icon = dp.status === 'ok' ? '✅' : dp.status === 'warning' ? '⚠️' : '❌';
      const bugStr = dp.bugs > 0 ? ` (${dp.bugs} ${dp.bugs === 1 ? 'bug' : 'bugs'})` : '';
      lines.push(`  ${icon} ${dp.timestamp} — ${dp.scenario}${bugStr}`);
    }
  }

  return lines.join('\n');
}

function emptyStats(): RecordingStats {
  return {
    totalRecordings: 0,
    uniqueScenarios: [],
    totalDurationSeconds: 0,
    totalBugs: 0,
    totalRegressions: 0,
    mostRecordedScenario: '',
    mostRecordedCount: 0,
    qualityTrend: [],
    firstRecording: '',
    lastRecording: '',
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}
