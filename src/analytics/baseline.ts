import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

/** Result of comparing a recording against its baseline. */
export interface BaselineComparison {
  scenarioName: string;
  baselineTimestamp: string;
  currentTimestamp: string;
  changes: BaselineChange[];
  passed: boolean;
}

/** Individual change detected between baseline and current recording. */
export interface BaselineChange {
  field: string;
  baseline: string | number;
  current: string | number;
  severity: 'ok' | 'warning' | 'error';
  description: string;
}

/** Saved baseline data. */
export interface BaselineData {
  scenario: string;
  savedAt: string;
  status: string;
  bugs: number;
  duration: number;
  frames: number;
  reportPath: string;
}

/**
 * Save a recording report as the baseline for a scenario.
 */
export async function saveBaseline(
  outputDir: string,
  scenarioName: string,
): Promise<{ baselinePath: string; savedFrom: string }> {
  // Find the latest recording for this scenario
  const latestLink = join(outputDir, 'latest');
  if (!existsSync(latestLink)) {
    throw new Error('No recordings found. Record a session first.');
  }

  const { realpath } = await import('node:fs/promises');
  const latestDir = await realpath(latestLink);
  const reportPath = join(latestDir, scenarioName, 'report.json');

  if (!existsSync(reportPath)) {
    throw new Error(`No recording found for scenario "${scenarioName}" in latest session.`);
  }

  const report = JSON.parse(await readFile(reportPath, 'utf-8'));

  const baselinesDir = join(outputDir, 'baselines');
  if (!existsSync(baselinesDir)) {
    await mkdir(baselinesDir, { recursive: true });
  }

  const baselineData: BaselineData = {
    scenario: report.scenario ?? scenarioName,
    savedAt: new Date().toISOString(),
    status: report.overall_status ?? 'unknown',
    bugs: report.bugs_found ?? 0,
    duration: report.duration_seconds ?? 0,
    frames: report.total_frames_analyzed ?? 0,
    reportPath,
  };

  const baselinePath = join(baselinesDir, `${scenarioName}.json`);
  await writeFile(baselinePath, JSON.stringify(baselineData, null, 2), 'utf-8');

  return { baselinePath, savedFrom: reportPath };
}

/**
 * Compare the latest recording against the saved baseline.
 */
export async function checkBaseline(
  outputDir: string,
  scenarioName: string,
): Promise<BaselineComparison> {
  // Load baseline
  const baselinePath = join(outputDir, 'baselines', `${scenarioName}.json`);
  if (!existsSync(baselinePath)) {
    throw new Error(`No baseline found for scenario "${scenarioName}". Run "baseline save" first.`);
  }

  const baseline: BaselineData = JSON.parse(await readFile(baselinePath, 'utf-8'));

  // Find the latest recording
  const latestLink = join(outputDir, 'latest');
  if (!existsSync(latestLink)) {
    throw new Error('No recordings found. Record a session first.');
  }

  const { realpath } = await import('node:fs/promises');
  const latestDir = await realpath(latestLink);
  const reportPath = join(latestDir, scenarioName, 'report.json');

  if (!existsSync(reportPath)) {
    throw new Error(`No recording found for scenario "${scenarioName}" in latest session.`);
  }

  const report = JSON.parse(await readFile(reportPath, 'utf-8'));

  // Compare
  const changes: BaselineChange[] = [];

  // Status comparison
  const currentStatus = report.overall_status ?? 'unknown';
  if (currentStatus !== baseline.status) {
    const isRegression = baseline.status === 'ok' && currentStatus !== 'ok';
    changes.push({
      field: 'Status',
      baseline: baseline.status,
      current: currentStatus,
      severity: isRegression ? 'error' : 'ok',
      description: isRegression
        ? `Status regressed from ${baseline.status} to ${currentStatus}`
        : `Status changed from ${baseline.status} to ${currentStatus}`,
    });
  }

  // Bug count comparison
  const currentBugs = report.bugs_found ?? 0;
  if (currentBugs !== baseline.bugs) {
    const isRegression = currentBugs > baseline.bugs;
    changes.push({
      field: 'Bugs',
      baseline: baseline.bugs,
      current: currentBugs,
      severity: isRegression ? 'error' : 'ok',
      description: isRegression
        ? `Bug count increased from ${baseline.bugs} to ${currentBugs}`
        : `Bug count decreased from ${baseline.bugs} to ${currentBugs}`,
    });
  }

  // Duration comparison (warn if >25% change)
  const currentDuration = report.duration_seconds ?? 0;
  if (baseline.duration > 0) {
    const changePercent = Math.round(((currentDuration - baseline.duration) / baseline.duration) * 100);
    if (Math.abs(changePercent) > 25) {
      changes.push({
        field: 'Duration',
        baseline: baseline.duration,
        current: currentDuration,
        severity: 'warning',
        description: `Duration changed by ${changePercent > 0 ? '+' : ''}${changePercent}% (${baseline.duration.toFixed(1)}s → ${currentDuration.toFixed(1)}s)`,
      });
    }
  }

  // Frame count comparison
  const currentFrames = report.total_frames_analyzed ?? 0;
  if (currentFrames !== baseline.frames) {
    const diff = currentFrames - baseline.frames;
    changes.push({
      field: 'Frames',
      baseline: baseline.frames,
      current: currentFrames,
      severity: 'ok',
      description: `Frame count changed: ${baseline.frames} → ${currentFrames} (${diff > 0 ? '+' : ''}${diff})`,
    });
  }

  const hasRegressions = changes.some((c) => c.severity === 'error');

  return {
    scenarioName,
    baselineTimestamp: baseline.savedAt,
    currentTimestamp: new Date().toISOString(),
    changes,
    passed: !hasRegressions,
  };
}

/**
 * Format a baseline comparison as a human-readable report.
 */
export function formatBaselineComparison(comparison: BaselineComparison): string {
  const lines: string[] = [];

  lines.push(`Baseline Check: ${comparison.scenarioName}`);
  lines.push('─'.repeat(40));
  lines.push(`Baseline saved: ${comparison.baselineTimestamp}`);
  lines.push('');

  if (comparison.changes.length === 0) {
    lines.push('  ✓ No changes — matches baseline exactly.');
  } else {
    for (const change of comparison.changes) {
      const icon = change.severity === 'error' ? '✗' : change.severity === 'warning' ? '⚠' : '✓';
      lines.push(`  ${icon} ${change.description}`);
    }
  }

  lines.push('');
  lines.push(comparison.passed
    ? '✓ PASS — no regressions detected'
    : '✗ FAIL — regressions detected');

  return lines.join('\n');
}

/**
 * List all saved baselines.
 */
export async function listBaselines(outputDir: string): Promise<BaselineData[]> {
  const baselinesDir = join(outputDir, 'baselines');
  if (!existsSync(baselinesDir)) return [];

  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(baselinesDir);
  const baselines: BaselineData[] = [];

  for (const entry of entries) {
    if (entry.endsWith('.json')) {
      try {
        const data = JSON.parse(await readFile(join(baselinesDir, entry), 'utf-8'));
        baselines.push(data);
      } catch {
        // Skip corrupt baseline files
      }
    }
  }

  return baselines;
}
