import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/** Summary data for a single scenario. */
export interface ScenarioSummary {
  name: string;
  status: string;
  bugs: number;
  duration: number;
  hasVideo: boolean;
  hasReport: boolean;
}

/** Complete summary for a recording session. */
export interface SessionSummary {
  /** Session timestamp directory name. */
  sessionId: string;
  /** Full path to the session directory. */
  sessionPath: string;
  /** Total number of scenarios. */
  scenarioCount: number;
  /** Number of scenarios that passed (status ok). */
  passedCount: number;
  /** Number of scenarios that failed (status error/warning). */
  failedCount: number;
  /** Total bugs across all scenarios. */
  totalBugs: number;
  /** Total recording duration in seconds. */
  totalDuration: number;
  /** Estimated disk usage in bytes. */
  diskUsageBytes: number;
  /** Per-scenario details. */
  scenarios: ScenarioSummary[];
}

/**
 * Generate a summary for the latest recording session.
 */
export async function generateSessionSummary(outputDir: string): Promise<SessionSummary | null> {
  const latestLink = join(outputDir, 'latest');
  if (!existsSync(latestLink)) return null;

  const { realpath } = await import('node:fs/promises');
  const latestDir = await realpath(latestLink);

  // Extract session ID from path
  const parts = latestDir.split('/');
  const sessionId = parts[parts.length - 1];

  return summarizeSession(outputDir, sessionId);
}

/**
 * Generate a summary for a specific recording session.
 */
export async function summarizeSession(outputDir: string, sessionId: string): Promise<SessionSummary> {
  const sessionPath = join(outputDir, sessionId);
  if (!existsSync(sessionPath)) {
    throw new Error(`Session not found: ${sessionPath}`);
  }

  const entries = await readdir(sessionPath);
  const scenarios: ScenarioSummary[] = [];
  let totalDuration = 0;
  let totalBugs = 0;
  let passedCount = 0;
  let failedCount = 0;

  for (const entry of entries) {
    const scenarioDir = join(sessionPath, entry);
    const reportPath = join(scenarioDir, 'report.json');

    if (!existsSync(reportPath)) continue;

    try {
      const report = JSON.parse(await readFile(reportPath, 'utf-8'));
      const status = report.overall_status ?? 'unknown';
      const bugs = report.bugs_found ?? 0;
      const duration = report.duration_seconds ?? 0;

      const hasVideo = existsSync(join(scenarioDir, 'raw.mp4')) ||
                       existsSync(join(scenarioDir, 'raw.gif')) ||
                       existsSync(join(scenarioDir, 'raw.webm'));
      const hasReport = true;

      scenarios.push({ name: report.scenario ?? entry, status, bugs, duration, hasVideo, hasReport });

      totalDuration += duration;
      totalBugs += bugs;
      if (status === 'ok') passedCount++;
      else failedCount++;
    } catch {
      // Skip corrupt reports
    }
  }

  const diskUsageBytes = await estimateDiskUsage(sessionPath);

  return {
    sessionId,
    sessionPath,
    scenarioCount: scenarios.length,
    passedCount,
    failedCount,
    totalBugs,
    totalDuration: parseFloat(totalDuration.toFixed(1)),
    diskUsageBytes,
    scenarios,
  };
}

/** Recursively estimate disk usage of a directory. */
async function estimateDiskUsage(dirPath: string): Promise<number> {
  let total = 0;

  try {
    const entries = await readdir(dirPath);
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const st = await stat(fullPath);
      if (st.isDirectory()) {
        total += await estimateDiskUsage(fullPath);
      } else {
        total += st.size;
      }
    }
  } catch {
    // Silently handle permission errors
  }

  return total;
}

/** Format bytes as a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format a session summary as a compact human-readable dashboard.
 */
export function formatSessionSummary(summary: SessionSummary): string {
  const lines: string[] = [];

  lines.push(`Session Summary: ${summary.sessionId}`);
  lines.push('═'.repeat(50));
  lines.push('');

  const passRate = summary.scenarioCount > 0
    ? ((summary.passedCount / summary.scenarioCount) * 100).toFixed(0)
    : '0';

  lines.push(`  Scenarios:  ${summary.scenarioCount} total (${summary.passedCount} passed, ${summary.failedCount} failed)`);
  lines.push(`  Pass Rate:  ${passRate}%`);
  lines.push(`  Bugs:       ${summary.totalBugs}`);
  lines.push(`  Duration:   ${summary.totalDuration.toFixed(1)}s`);
  lines.push(`  Disk Usage: ${formatBytes(summary.diskUsageBytes)}`);
  lines.push('');

  if (summary.scenarios.length > 0) {
    lines.push('Scenarios:');
    lines.push('─'.repeat(50));
    for (const s of summary.scenarios) {
      const icon = s.status === 'ok' ? '✓' : s.status === 'warning' ? '⚠' : '✗';
      const bugsStr = s.bugs > 0 ? ` (${s.bugs} bugs)` : '';
      lines.push(`  ${icon} ${s.name.padEnd(24)} ${s.status.padEnd(10)} ${s.duration.toFixed(1)}s${bugsStr}`);
    }
  }

  return lines.join('\n');
}
