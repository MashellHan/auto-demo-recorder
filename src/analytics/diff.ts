import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Report } from '../pipeline/regression.js';

export interface ScenarioDiff {
  /** Scenario name. */
  scenario: string;
  /** Duration change. */
  durationA: number;
  durationB: number;
  durationDelta: number;
  durationDeltaPct: number;
  /** Status change. */
  statusA: string;
  statusB: string;
  /** Bug count change. */
  bugsA: number;
  bugsB: number;
  /** Frame count change. */
  framesA: number;
  framesB: number;
  /** Whether this scenario improved, regressed, or stayed the same. */
  trend: 'improved' | 'regressed' | 'unchanged' | 'new' | 'removed';
}

export interface SessionDiffResult {
  /** Session A identifier (timestamp directory name). */
  sessionA: string;
  /** Session B identifier (timestamp directory name). */
  sessionB: string;
  /** Per-scenario diffs. */
  diffs: ScenarioDiff[];
  /** Summary counts. */
  improved: number;
  regressed: number;
  unchanged: number;
  newScenarios: number;
  removedScenarios: number;
}

/**
 * Load all report.json files from a session directory.
 * Returns a map of scenario name → Report.
 */
async function loadSessionReports(sessionDir: string): Promise<Map<string, Report>> {
  const reports = new Map<string, Report>();

  if (!existsSync(sessionDir)) {
    return reports;
  }

  const entries = await readdir(sessionDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const reportPath = join(sessionDir, entry.name, 'report.json');
    if (!existsSync(reportPath)) continue;

    try {
      const content = await readFile(reportPath, 'utf-8');
      const report = JSON.parse(content) as Report;
      reports.set(report.scenario, report);
    } catch {
      // Skip malformed reports
    }
  }

  return reports;
}

function determineTrend(a: Report, b: Report): ScenarioDiff['trend'] {
  const aScore = (a.bugs_found ?? 0) + (a.overall_status === 'error' ? 10 : a.overall_status === 'warning' ? 5 : 0);
  const bScore = (b.bugs_found ?? 0) + (b.overall_status === 'error' ? 10 : b.overall_status === 'warning' ? 5 : 0);

  if (bScore < aScore) return 'improved';
  if (bScore > aScore) return 'regressed';
  return 'unchanged';
}

/**
 * Compare two recording sessions and produce per-scenario diffs.
 */
export async function diffSessions(
  outputDir: string,
  sessionNameA: string,
  sessionNameB: string,
): Promise<SessionDiffResult> {
  const dirA = join(outputDir, sessionNameA);
  const dirB = join(outputDir, sessionNameB);

  const reportsA = await loadSessionReports(dirA);
  const reportsB = await loadSessionReports(dirB);

  const allScenarios = new Set([...reportsA.keys(), ...reportsB.keys()]);
  const diffs: ScenarioDiff[] = [];

  for (const scenario of allScenarios) {
    const a = reportsA.get(scenario);
    const b = reportsB.get(scenario);

    if (a && b) {
      const durationDelta = (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0);
      const durationA = a.duration_seconds ?? 0;
      const durationDeltaPct = durationA > 0 ? (durationDelta / durationA) * 100 : 0;

      diffs.push({
        scenario,
        durationA: a.duration_seconds ?? 0,
        durationB: b.duration_seconds ?? 0,
        durationDelta,
        durationDeltaPct,
        statusA: a.overall_status,
        statusB: b.overall_status,
        bugsA: a.bugs_found ?? 0,
        bugsB: b.bugs_found ?? 0,
        framesA: a.total_frames_analyzed ?? 0,
        framesB: b.total_frames_analyzed ?? 0,
        trend: determineTrend(a, b),
      });
    } else if (b && !a) {
      diffs.push({
        scenario,
        durationA: 0,
        durationB: b.duration_seconds ?? 0,
        durationDelta: b.duration_seconds ?? 0,
        durationDeltaPct: 0,
        statusA: '',
        statusB: b.overall_status,
        bugsA: 0,
        bugsB: b.bugs_found ?? 0,
        framesA: 0,
        framesB: b.total_frames_analyzed ?? 0,
        trend: 'new',
      });
    } else if (a && !b) {
      diffs.push({
        scenario,
        durationA: a.duration_seconds ?? 0,
        durationB: 0,
        durationDelta: -(a.duration_seconds ?? 0),
        durationDeltaPct: -100,
        statusA: a.overall_status,
        statusB: '',
        bugsA: a.bugs_found ?? 0,
        bugsB: 0,
        framesA: a.total_frames_analyzed ?? 0,
        framesB: 0,
        trend: 'removed',
      });
    }
  }

  // Sort by scenario name
  diffs.sort((a, b) => a.scenario.localeCompare(b.scenario));

  return {
    sessionA: sessionNameA,
    sessionB: sessionNameB,
    diffs,
    improved: diffs.filter((d) => d.trend === 'improved').length,
    regressed: diffs.filter((d) => d.trend === 'regressed').length,
    unchanged: diffs.filter((d) => d.trend === 'unchanged').length,
    newScenarios: diffs.filter((d) => d.trend === 'new').length,
    removedScenarios: diffs.filter((d) => d.trend === 'removed').length,
  };
}

/**
 * Format a session diff result as a human-readable summary.
 */
export function formatSessionDiff(result: SessionDiffResult): string {
  const lines: string[] = [];

  lines.push('Session Comparison');
  lines.push(`${'─'.repeat(50)}`);
  lines.push(`  Session A: ${result.sessionA}`);
  lines.push(`  Session B: ${result.sessionB}`);
  lines.push('');

  if (result.diffs.length === 0) {
    lines.push('No scenarios found in either session.');
    return lines.join('\n');
  }

  for (const diff of result.diffs) {
    const trendIcon = diff.trend === 'improved' ? '✅'
      : diff.trend === 'regressed' ? '❌'
      : diff.trend === 'new' ? '🆕'
      : diff.trend === 'removed' ? '🗑️'
      : '➡️';

    lines.push(`${trendIcon} ${diff.scenario}:`);

    if (diff.trend === 'new') {
      lines.push(`  NEW — Duration: ${diff.durationB.toFixed(1)}s, Status: ${diff.statusB}, Bugs: ${diff.bugsB}`);
    } else if (diff.trend === 'removed') {
      lines.push(`  REMOVED — Was: ${diff.durationA.toFixed(1)}s, Status: ${diff.statusA}`);
    } else {
      const durationSign = diff.durationDelta >= 0 ? '+' : '';
      const durationPct = diff.durationDeltaPct !== 0 ? ` (${durationSign}${diff.durationDeltaPct.toFixed(0)}%)` : '';
      lines.push(`  Duration: ${diff.durationA.toFixed(1)}s → ${diff.durationB.toFixed(1)}s${durationPct}`);

      if (diff.statusA !== diff.statusB) {
        const label = diff.trend === 'improved' ? ' ✅ IMPROVED' : diff.trend === 'regressed' ? ' ❌ REGRESSED' : '';
        lines.push(`  Status: ${diff.statusA} → ${diff.statusB}${label}`);
      } else {
        lines.push(`  Status: ${diff.statusA}`);
      }

      if (diff.bugsA !== diff.bugsB) {
        const bugLabel = diff.bugsB < diff.bugsA ? ' ✅ FIXED' : ' ❌ NEW BUGS';
        lines.push(`  Bugs: ${diff.bugsA} → ${diff.bugsB}${bugLabel}`);
      } else {
        lines.push(`  Bugs: ${diff.bugsA}`);
      }
    }
    lines.push('');
  }

  lines.push(`${'─'.repeat(50)}`);
  const parts: string[] = [];
  if (result.improved > 0) parts.push(`${result.improved} improved`);
  if (result.regressed > 0) parts.push(`${result.regressed} regressed`);
  if (result.unchanged > 0) parts.push(`${result.unchanged} unchanged`);
  if (result.newScenarios > 0) parts.push(`${result.newScenarios} new`);
  if (result.removedScenarios > 0) parts.push(`${result.removedScenarios} removed`);
  lines.push(`Summary: ${parts.join(', ')}`);

  return lines.join('\n');
}
