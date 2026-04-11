import { readFile } from 'node:fs/promises';

/** Per-frame data stored in a recording report JSON file. */
export interface ReportFrame {
  /** Zero-based frame index. */
  index: number;
  /** Human-readable timestamp (e.g. "0:05"). */
  timestamp: string;
  /** AI-assessed status for this frame. */
  status: 'ok' | 'warning' | 'error';
  /** AI-generated description of what the frame shows. */
  description: string;
  /** Feature being demonstrated in this frame. */
  feature_being_demonstrated: string;
  /** Bugs detected by AI in this frame. */
  bugs_detected: string[];
  /** Visual quality assessment for this frame. */
  visual_quality: 'good' | 'degraded' | 'broken';
  /** Short overlay text used during video annotation. */
  annotation_text: string;
}

/** Full recording report written to `report.json` after each recording session. */
export interface Report {
  /** Project name from the config. */
  project: string;
  /** Scenario name that was recorded. */
  scenario: string;
  /** ISO 8601 timestamp of when the recording was made. */
  timestamp: string;
  /** Total recording duration in seconds. */
  duration_seconds: number;
  /** Number of frames that were analyzed by AI. */
  total_frames_analyzed: number;
  /** Worst status across all analyzed frames. */
  overall_status: 'ok' | 'warning' | 'error';
  /** Per-frame analysis results. */
  frames: ReportFrame[];
  /** Human-readable summary of the recording analysis. */
  summary: string;
  /** Total number of bugs detected across all frames. */
  bugs_found: number;
}

/** A single change detected between a baseline and current recording report. */
export interface RegressionChange {
  /** Category of the change. */
  type: 'new_bug' | 'resolved_bug' | 'status_change' | 'feature_lost' | 'feature_gained' | 'quality_change';
  /** Human-readable description of what changed. */
  description: string;
  /** Severity level: critical (new bugs, status worsening), warning (feature loss, quality degradation), or info (improvements). */
  severity: 'critical' | 'warning' | 'info';
}

/** Result of comparing two recording reports for regressions. */
export interface RegressionResult {
  /** File path to the baseline report. */
  baseline_report: string;
  /** File path to the current report. */
  current_report: string;
  /** ISO 8601 timestamp of the baseline recording. */
  baseline_timestamp: string;
  /** ISO 8601 timestamp of the current recording. */
  current_timestamp: string;
  /** Scenario name that was compared. */
  scenario: string;
  /** Whether any critical or warning-level changes were found. */
  has_regressions: boolean;
  /** List of all detected changes between baseline and current. */
  changes: RegressionChange[];
  /** Human-readable summary of the regression analysis. */
  summary: string;
}

/** Load and validate a recording report from a JSON file. Throws if required fields are missing. */
export async function loadReport(reportPath: string): Promise<Report> {
  const content = await readFile(reportPath, 'utf-8');
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed.project !== 'string' || typeof parsed.scenario !== 'string' || !Array.isArray(parsed.frames)) {
    throw new Error(`Invalid report: missing required fields (project, scenario, frames) in ${reportPath}`);
  }
  return parsed as Report;
}

/** Compare two reports and return a list of changes (bugs, features, status, quality). */
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

/** Load two reports by path, compare them, and return a full regression analysis result. */
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
