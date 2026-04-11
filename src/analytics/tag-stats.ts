import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/** Statistics for a single tag. */
export interface TagStat {
  tag: string;
  /** Number of scenarios with this tag. */
  scenarioCount: number;
  /** Total recordings analyzed. */
  recordingCount: number;
  /** Total bugs across all recordings. */
  totalBugs: number;
  /** Average bugs per recording. */
  avgBugs: number;
  /** Average duration in seconds. */
  avgDuration: number;
  /** Pass rate (0-1). */
  passRate: number;
}

/** Complete tag analytics. */
export interface TagAnalytics {
  tags: TagStat[];
  /** Tag with the highest pass rate. */
  bestTag: TagStat | null;
  /** Tag with the lowest pass rate. */
  worstTag: TagStat | null;
  /** Tag with the most bugs. */
  buggiestTag: TagStat | null;
}

/** Scenario config with tag info. */
interface ScenarioConfig {
  name: string;
  tags?: string[];
}

/**
 * Compute tag-level analytics from recording history.
 */
export async function computeTagStats(
  outputDir: string,
  scenarioConfigs: ScenarioConfig[],
): Promise<TagAnalytics> {
  // Build tag → scenarios mapping
  const tagScenarios = new Map<string, Set<string>>();
  for (const s of scenarioConfigs) {
    for (const tag of s.tags ?? []) {
      if (!tagScenarios.has(tag)) tagScenarios.set(tag, new Set());
      tagScenarios.get(tag)!.add(s.name);
    }
  }

  if (tagScenarios.size === 0) {
    return { tags: [], bestTag: null, worstTag: null, buggiestTag: null };
  }

  // Gather report data per scenario
  const scenarioReports = new Map<string, Array<{ status: string; bugs: number; duration: number }>>();

  if (existsSync(outputDir)) {
    const entries = await readdir(outputDir);
    const sessionDirs = entries.filter((e) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/.test(e));

    for (const dir of sessionDirs) {
      const sessionPath = join(outputDir, dir);
      const scenarioEntries = await readdir(sessionPath);

      for (const entry of scenarioEntries) {
        const reportPath = join(sessionPath, entry, 'report.json');
        if (!existsSync(reportPath)) continue;

        try {
          const report = JSON.parse(await readFile(reportPath, 'utf-8'));
          const name = report.scenario ?? entry;

          if (!scenarioReports.has(name)) scenarioReports.set(name, []);
          scenarioReports.get(name)!.push({
            status: report.overall_status ?? 'unknown',
            bugs: report.bugs_found ?? 0,
            duration: report.duration_seconds ?? 0,
          });
        } catch {
          // Skip corrupt reports
        }
      }
    }
  }

  // Compute per-tag stats
  const tags: TagStat[] = [];

  for (const [tag, scenarios] of tagScenarios) {
    let totalBugs = 0;
    let totalDuration = 0;
    let totalPassed = 0;
    let recordingCount = 0;

    for (const scenarioName of scenarios) {
      const reports = scenarioReports.get(scenarioName) ?? [];
      for (const r of reports) {
        totalBugs += r.bugs;
        totalDuration += r.duration;
        if (r.status === 'ok') totalPassed++;
        recordingCount++;
      }
    }

    tags.push({
      tag,
      scenarioCount: scenarios.size,
      recordingCount,
      totalBugs,
      avgBugs: recordingCount > 0 ? parseFloat((totalBugs / recordingCount).toFixed(2)) : 0,
      avgDuration: recordingCount > 0 ? parseFloat((totalDuration / recordingCount).toFixed(1)) : 0,
      passRate: recordingCount > 0 ? parseFloat((totalPassed / recordingCount).toFixed(3)) : 1,
    });
  }

  // Sort by pass rate descending
  tags.sort((a, b) => b.passRate - a.passRate);

  const bestTag = tags.length > 0 ? tags[0] : null;
  const worstTag = tags.length > 0 ? tags[tags.length - 1] : null;
  const buggiestTag = tags.length > 0
    ? [...tags].sort((a, b) => b.totalBugs - a.totalBugs)[0]
    : null;

  return { tags, bestTag, worstTag, buggiestTag };
}

/**
 * Format tag analytics as a human-readable report.
 */
export function formatTagStats(analytics: TagAnalytics): string {
  const lines: string[] = [];

  lines.push('Tag-Level Analytics');
  lines.push('═'.repeat(50));

  if (analytics.tags.length === 0) {
    lines.push('  No tagged scenarios found.');
    return lines.join('\n');
  }

  lines.push('');
  for (const t of analytics.tags) {
    const icon = t.passRate >= 0.9 ? '✓' : t.passRate >= 0.7 ? '⚠' : '✗';
    lines.push(`  ${icon} ${t.tag.padEnd(20)} Pass: ${(t.passRate * 100).toFixed(0)}%  |  Bugs: ${t.avgBugs}  |  Duration: ${t.avgDuration}s  |  Scenarios: ${t.scenarioCount}`);
  }

  lines.push('');
  if (analytics.bestTag) {
    lines.push(`  Best:    ${analytics.bestTag.tag} (${(analytics.bestTag.passRate * 100).toFixed(0)}% pass rate)`);
  }
  if (analytics.worstTag && analytics.worstTag !== analytics.bestTag) {
    lines.push(`  Worst:   ${analytics.worstTag.tag} (${(analytics.worstTag.passRate * 100).toFixed(0)}% pass rate)`);
  }
  if (analytics.buggiestTag && analytics.buggiestTag.totalBugs > 0) {
    lines.push(`  Buggiest: ${analytics.buggiestTag.tag} (${analytics.buggiestTag.totalBugs} total bugs)`);
  }

  return lines.join('\n');
}
