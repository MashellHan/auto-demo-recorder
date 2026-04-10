import { readFile } from 'node:fs/promises';

export interface ReportFrame {
  index: number;
  timestamp: string;
  status: 'ok' | 'warning' | 'error';
  description: string;
  feature_being_demonstrated: string;
  bugs_detected: string[];
  visual_quality: 'good' | 'degraded' | 'broken';
  annotation_text: string;
}

export interface Report {
  project: string;
  scenario: string;
  timestamp: string;
  duration_seconds: number;
  total_frames_analyzed: number;
  overall_status: 'ok' | 'warning' | 'error';
  frames: ReportFrame[];
  summary: string;
  bugs_found: number;
}

export interface RegressionChange {
  type: 'new_bug' | 'resolved_bug' | 'status_change' | 'feature_lost' | 'feature_gained' | 'quality_change';
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface RegressionResult {
  baseline_report: string;
  current_report: string;
  baseline_timestamp: string;
  current_timestamp: string;
  scenario: string;
  has_regressions: boolean;
  changes: RegressionChange[];
  summary: string;
}

export async function loadReport(reportPath: string): Promise<Report> {
  const content = await readFile(reportPath, 'utf-8');
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed.project !== 'string' || typeof parsed.scenario !== 'string' || !Array.isArray(parsed.frames)) {
    throw new Error(`Invalid report: missing required fields (project, scenario, frames) in ${reportPath}`);
  }
  return parsed as Report;
}

export function compareReports(baseline: Report, current: Report): RegressionChange[] {
  const changes: RegressionChange[] = [];

  // Status changes
  if (baseline.overall_status !== current.overall_status) {
    const worsened = statusRank(current.overall_status) > statusRank(baseline.overall_status);
    changes.push({
      type: 'status_change',
      description: `Overall status changed from "${baseline.overall_status}" to "${current.overall_status}"`,
      severity: worsened ? 'critical' : 'info',
    });
  }

  // Bug comparison
  const baselineBugs = collectBugs(baseline.frames);
  const currentBugs = collectBugs(current.frames);

  for (const bug of currentBugs) {
    if (!baselineBugs.includes(bug)) {
      changes.push({
        type: 'new_bug',
        description: `New bug detected: ${bug}`,
        severity: 'critical',
      });
    }
  }

  for (const bug of baselineBugs) {
    if (!currentBugs.includes(bug)) {
      changes.push({
        type: 'resolved_bug',
        description: `Bug resolved: ${bug}`,
        severity: 'info',
      });
    }
  }

  // Feature comparison
  const baselineFeatures = collectFeatures(baseline.frames);
  const currentFeatures = collectFeatures(current.frames);

  for (const feature of baselineFeatures) {
    if (!currentFeatures.includes(feature)) {
      changes.push({
        type: 'feature_lost',
        description: `Feature no longer demonstrated: ${feature}`,
        severity: 'warning',
      });
    }
  }

  for (const feature of currentFeatures) {
    if (!baselineFeatures.includes(feature)) {
      changes.push({
        type: 'feature_gained',
        description: `New feature demonstrated: ${feature}`,
        severity: 'info',
      });
    }
  }

  // Visual quality changes
  const baselineQualities = collectQualities(baseline.frames);
  const currentQualities = collectQualities(current.frames);

  const baselineDegraded = baselineQualities.filter((q) => q !== 'good').length;
  const currentDegraded = currentQualities.filter((q) => q !== 'good').length;

  if (currentDegraded > baselineDegraded) {
    changes.push({
      type: 'quality_change',
      description: `Visual quality degraded: ${currentDegraded} frames with issues (was ${baselineDegraded})`,
      severity: 'warning',
    });
  } else if (currentDegraded < baselineDegraded) {
    changes.push({
      type: 'quality_change',
      description: `Visual quality improved: ${currentDegraded} frames with issues (was ${baselineDegraded})`,
      severity: 'info',
    });
  }

  return changes;
}

export async function detectRegressions(
  baselinePath: string,
  currentPath: string,
): Promise<RegressionResult> {
  const baseline = await loadReport(baselinePath);
  const current = await loadReport(currentPath);
  const changes = compareReports(baseline, current);

  const hasRegressions = changes.some(
    (c) => c.severity === 'critical' || c.severity === 'warning',
  );

  return {
    baseline_report: baselinePath,
    current_report: currentPath,
    baseline_timestamp: baseline.timestamp,
    current_timestamp: current.timestamp,
    scenario: current.scenario,
    has_regressions: hasRegressions,
    changes,
    summary: buildRegressionSummary(changes),
  };
}

function statusRank(status: string): number {
  switch (status) {
    case 'ok': return 0;
    case 'warning': return 1;
    case 'error': return 2;
    default: return 0;
  }
}

function collectBugs(frames: ReportFrame[]): string[] {
  return [...new Set(frames.flatMap((f) => f.bugs_detected))];
}

function collectFeatures(frames: ReportFrame[]): string[] {
  return [...new Set(frames.map((f) => f.feature_being_demonstrated).filter(Boolean))];
}

function collectQualities(frames: ReportFrame[]): string[] {
  return frames.map((f) => f.visual_quality);
}

function buildRegressionSummary(changes: RegressionChange[]): string {
  if (changes.length === 0) {
    return 'No changes detected between baseline and current recording.';
  }

  const critical = changes.filter((c) => c.severity === 'critical');
  const warnings = changes.filter((c) => c.severity === 'warning');
  const info = changes.filter((c) => c.severity === 'info');

  const parts: string[] = [];
  if (critical.length > 0) parts.push(`${critical.length} critical`);
  if (warnings.length > 0) parts.push(`${warnings.length} warning`);
  if (info.length > 0) parts.push(`${info.length} info`);

  return `${changes.length} changes detected (${parts.join(', ')}).`;
}
