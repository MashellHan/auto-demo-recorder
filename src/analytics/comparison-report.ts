import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/** Scenario-level comparison between two sessions. */
export interface ScenarioComparison {
  /** Scenario name. */
  scenario: string;
  /** Status in session A, or null if missing. */
  statusA: string | null;
  /** Status in session B, or null if missing. */
  statusB: string | null;
  /** Bug count in session A. */
  bugsA: number;
  /** Bug count in session B. */
  bugsB: number;
  /** Duration in session A (seconds). */
  durationA: number;
  /** Duration in session B (seconds). */
  durationB: number;
  /** Whether status changed between sessions. */
  statusChanged: boolean;
  /** Whether bug count changed. */
  bugsChanged: boolean;
}

/** Full comparison report between two sessions. */
export interface ComparisonReport {
  /** Session A identifier. */
  sessionA: string;
  /** Session B identifier. */
  sessionB: string;
  /** Per-scenario comparisons. */
  comparisons: ScenarioComparison[];
  /** Scenarios only in session A. */
  onlyInA: string[];
  /** Scenarios only in session B. */
  onlyInB: string[];
  /** Total scenarios compared. */
  totalScenarios: number;
  /** Number of scenarios with status changes. */
  statusChanges: number;
  /** Number of scenarios with bug count changes. */
  bugChanges: number;
}

interface ReportData {
  scenario?: string;
  overall_status?: string;
  bugs_found?: number;
  duration_seconds?: number;
}

async function loadSessionReports(outputDir: string, sessionId: string): Promise<Map<string, ReportData>> {
  const sessionDir = join(outputDir, sessionId);
  const reports = new Map<string, ReportData>();

  if (!existsSync(sessionDir)) return reports;

  try {
    const entries = await readdir(sessionDir);
    for (const entry of entries) {
      const reportPath = join(sessionDir, entry, 'report.json');
      if (existsSync(reportPath)) {
        try {
          const raw = await readFile(reportPath, 'utf-8');
          const data = JSON.parse(raw) as ReportData;
          reports.set(entry, data);
        } catch { /* skip invalid reports */ }
      }
    }
  } catch { /* skip unreadable sessions */ }

  return reports;
}

/**
 * Generate a comparison report between two recording sessions.
 * Combines per-scenario status, bug count, and duration differences.
 */
export async function generateComparisonReport(
  outputDir: string,
  sessionA: string,
  sessionB: string,
): Promise<ComparisonReport> {
  const reportsA = await loadSessionReports(outputDir, sessionA);
  const reportsB = await loadSessionReports(outputDir, sessionB);

  const allScenarios = new Set([...reportsA.keys(), ...reportsB.keys()]);
  const comparisons: ScenarioComparison[] = [];
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];

  for (const scenario of allScenarios) {
    const a = reportsA.get(scenario);
    const b = reportsB.get(scenario);

    if (a && !b) {
      onlyInA.push(scenario);
      continue;
    }
    if (!a && b) {
      onlyInB.push(scenario);
      continue;
    }

    const statusA = a?.overall_status ?? null;
    const statusB = b?.overall_status ?? null;
    const bugsA = a?.bugs_found ?? 0;
    const bugsB = b?.bugs_found ?? 0;
    const durationA = a?.duration_seconds ?? 0;
    const durationB = b?.duration_seconds ?? 0;

    comparisons.push({
      scenario,
      statusA,
      statusB,
      bugsA,
      bugsB,
      durationA,
      durationB,
      statusChanged: statusA !== statusB,
      bugsChanged: bugsA !== bugsB,
    });
  }

  return {
    sessionA,
    sessionB,
    comparisons,
    onlyInA,
    onlyInB,
    totalScenarios: allScenarios.size,
    statusChanges: comparisons.filter((c) => c.statusChanged).length,
    bugChanges: comparisons.filter((c) => c.bugsChanged).length,
  };
}

/** Format a status icon. */
function statusIcon(status: string | null): string {
  if (!status) return '—';
  if (status === 'ok') return '✓';
  if (status === 'error' || status === 'fail') return '✗';
  return '⚠';
}

/** Format a bug change delta. */
function bugDelta(a: number, b: number): string {
  const diff = b - a;
  if (diff === 0) return '→ 0';
  if (diff > 0) return `↑ +${diff}`;
  return `↓ ${diff}`;
}

/** Format a duration change. */
function durationDelta(a: number, b: number): string {
  const diff = b - a;
  if (Math.abs(diff) < 0.5) return '≈';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}s`;
}

/**
 * Format a comparison report as human-readable text.
 */
export function formatComparisonReport(report: ComparisonReport): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push(`  Session Comparison: ${report.sessionA} vs ${report.sessionB}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  if (report.comparisons.length === 0 && report.onlyInA.length === 0 && report.onlyInB.length === 0) {
    lines.push('  No scenarios found in either session.');
    return lines.join('\n');
  }

  // Summary
  lines.push(`  Total scenarios: ${report.totalScenarios}`);
  lines.push(`  Status changes:  ${report.statusChanges}`);
  lines.push(`  Bug changes:     ${report.bugChanges}`);
  lines.push('');

  // Per-scenario comparison
  if (report.comparisons.length > 0) {
    lines.push('  Scenario Comparisons:');
    lines.push('  ─────────────────────────────────────────────────');

    for (const c of report.comparisons) {
      const statusStr = c.statusChanged
        ? `${statusIcon(c.statusA)} → ${statusIcon(c.statusB)}`
        : `${statusIcon(c.statusA)} (unchanged)`;
      const bugsStr = bugDelta(c.bugsA, c.bugsB);
      const durStr = durationDelta(c.durationA, c.durationB);

      lines.push(`  ${c.scenario}`);
      lines.push(`    Status: ${statusStr}  Bugs: ${bugsStr}  Duration: ${durStr}`);
    }
    lines.push('');
  }

  // Only-in lists
  if (report.onlyInA.length > 0) {
    lines.push(`  Only in ${report.sessionA}:`);
    for (const s of report.onlyInA) {
      lines.push(`    - ${s}`);
    }
    lines.push('');
  }
  if (report.onlyInB.length > 0) {
    lines.push(`  Only in ${report.sessionB}:`);
    for (const s of report.onlyInB) {
      lines.push(`    - ${s}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
