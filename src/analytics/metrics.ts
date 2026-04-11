import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/** Quality metric for a single scenario. */
export interface ScenarioMetric {
  name: string;
  /** Stability: ratio of successful recordings (0-1). */
  stability: number;
  /** Average bug count across all sessions. */
  avgBugs: number;
  /** Bug trend: negative = improving, positive = degrading. */
  bugTrend: number;
  /** Average duration in seconds. */
  avgDuration: number;
  /** Duration consistency: standard deviation of duration. */
  durationStdDev: number;
  /** Number of recording sessions analyzed. */
  sessionCount: number;
}

/** Overall recording quality metrics. */
export interface QualityMetrics {
  /** Per-scenario metrics. */
  scenarios: ScenarioMetric[];
  /** Overall stability score (0-100). */
  overallStability: number;
  /** Overall bug density (bugs per recording). */
  bugDensity: number;
  /** Total sessions analyzed. */
  totalSessions: number;
  /** Total scenarios across all sessions. */
  totalScenarios: number;
}

/** Minimal report data needed for metrics calculation. */
interface ReportData {
  scenario: string;
  overall_status: string;
  bugs_found: number;
  duration_seconds: number;
}

/**
 * Compute recording quality metrics from the output directory.
 */
export async function computeMetrics(outputDir: string): Promise<QualityMetrics> {
  if (!existsSync(outputDir)) {
    return { scenarios: [], overallStability: 100, bugDensity: 0, totalSessions: 0, totalScenarios: 0 };
  }

  const entries = await readdir(outputDir);
  const sessionDirs = entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/.test(e))
    .sort();

  if (sessionDirs.length === 0) {
    return { scenarios: [], overallStability: 100, bugDensity: 0, totalSessions: 0, totalScenarios: 0 };
  }

  // Collect all report data grouped by scenario name
  const scenarioData = new Map<string, ReportData[]>();
  let totalScenarioCount = 0;

  for (const dir of sessionDirs) {
    const sessionPath = join(outputDir, dir);
    const scenarioEntries = await readdir(sessionPath);

    for (const entry of scenarioEntries) {
      const reportPath = join(sessionPath, entry, 'report.json');
      if (!existsSync(reportPath)) continue;

      try {
        const report: ReportData = JSON.parse(await readFile(reportPath, 'utf-8'));
        const name = report.scenario ?? entry;

        if (!scenarioData.has(name)) {
          scenarioData.set(name, []);
        }
        scenarioData.get(name)!.push(report);
        totalScenarioCount++;
      } catch {
        // Skip corrupt report files
      }
    }
  }

  // Compute per-scenario metrics
  const scenarios: ScenarioMetric[] = [];
  let totalBugs = 0;
  let totalSuccessful = 0;

  for (const [name, reports] of scenarioData) {
    const successful = reports.filter((r) => r.overall_status === 'ok').length;
    const stability = reports.length > 0 ? successful / reports.length : 1;

    const bugs = reports.map((r) => r.bugs_found ?? 0);
    const avgBugs = bugs.length > 0 ? bugs.reduce((a, b) => a + b, 0) / bugs.length : 0;
    totalBugs += bugs.reduce((a, b) => a + b, 0);
    totalSuccessful += successful;

    // Bug trend: compare first half to second half
    const mid = Math.floor(reports.length / 2);
    const firstHalf = bugs.slice(0, Math.max(1, mid));
    const secondHalf = bugs.slice(Math.max(1, mid));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : firstAvg;
    const bugTrend = parseFloat((secondAvg - firstAvg).toFixed(2));

    const durations = reports.map((r) => r.duration_seconds ?? 0);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const durationStdDev = computeStdDev(durations);

    scenarios.push({
      name,
      stability: parseFloat(stability.toFixed(3)),
      avgBugs: parseFloat(avgBugs.toFixed(2)),
      bugTrend,
      avgDuration: parseFloat(avgDuration.toFixed(1)),
      durationStdDev: parseFloat(durationStdDev.toFixed(2)),
      sessionCount: reports.length,
    });
  }

  const overallStability = totalScenarioCount > 0
    ? parseFloat(((totalSuccessful / totalScenarioCount) * 100).toFixed(1))
    : 100;

  const bugDensity = totalScenarioCount > 0
    ? parseFloat((totalBugs / totalScenarioCount).toFixed(2))
    : 0;

  return {
    scenarios,
    overallStability,
    bugDensity,
    totalSessions: sessionDirs.length,
    totalScenarios: totalScenarioCount,
  };
}

/** Compute standard deviation. */
function computeStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Format quality metrics as a human-readable report.
 */
export function formatMetrics(metrics: QualityMetrics): string {
  const lines: string[] = [];

  lines.push('Recording Quality Metrics');
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`  Overall Stability: ${metrics.overallStability}%`);
  lines.push(`  Bug Density:       ${metrics.bugDensity} bugs/recording`);
  lines.push(`  Sessions:          ${metrics.totalSessions}`);
  lines.push(`  Total Recordings:  ${metrics.totalScenarios}`);
  lines.push('');

  if (metrics.scenarios.length === 0) {
    lines.push('  No scenario data available.');
    return lines.join('\n');
  }

  lines.push('Per-Scenario Breakdown:');
  lines.push('─'.repeat(50));

  for (const s of metrics.scenarios) {
    const stabilityIcon = s.stability >= 0.9 ? '✓' : s.stability >= 0.7 ? '⚠' : '✗';
    const trendIcon = s.bugTrend < 0 ? '↓' : s.bugTrend > 0 ? '↑' : '→';
    lines.push(`  ${stabilityIcon} ${s.name}`);
    lines.push(`    Stability: ${(s.stability * 100).toFixed(0)}%  |  Bugs: ${s.avgBugs} (${trendIcon})  |  Duration: ${s.avgDuration}s (±${s.durationStdDev}s)  |  Sessions: ${s.sessionCount}`);
  }

  return lines.join('\n');
}
