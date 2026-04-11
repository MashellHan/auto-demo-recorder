import { readFile } from 'node:fs/promises';
import { parsePause } from '../pipeline/browser-step-executor.js';

/** Timing data for a single recording step. */
export interface StepTiming {
  /** 1-based step index. */
  index: number;
  /** Step action type (e.g., "type", "key", "sleep"). */
  action: string;
  /** Step value (command text, key name, duration). */
  value: string;
  /** Duration in seconds for this step. */
  durationSeconds: number;
  /** Percentage of total recording time this step consumed. */
  percentOfTotal: number;
}

/** Complete timing analysis for a recording. */
export interface TimingAnalysis {
  scenarioName: string;
  totalDurationSeconds: number;
  steps: StepTiming[];
  slowestStep: StepTiming | null;
  suggestions: string[];
}

/**
 * Analyze step timing from a recording report.
 *
 * Extracts per-step timing from frame timestamps and generates
 * optimization suggestions for slow steps.
 */
export async function analyzeTimingFromReport(reportPath: string): Promise<TimingAnalysis> {
  const raw = await readFile(reportPath, 'utf-8');
  const report = JSON.parse(raw);
  return analyzeTimingFromData(report);
}

/**
 * Analyze step timing from a parsed report object.
 */
export function analyzeTimingFromData(report: {
  scenario: string;
  duration_seconds?: number;
  frames?: Array<{ timestamp_seconds?: number; description?: string }>;
  steps?: Array<{ action: string; value: string; pause?: string }>;
}): TimingAnalysis {
  const scenarioName = report.scenario ?? 'unknown';
  const totalDuration = report.duration_seconds ?? 0;

  // Build steps from report data
  const steps: StepTiming[] = [];

  if (report.frames && report.frames.length > 0) {
    // Use frame timestamps to compute inter-frame durations
    for (let i = 0; i < report.frames.length; i++) {
      const frame = report.frames[i];
      const nextFrame = report.frames[i + 1];
      const startTime = frame.timestamp_seconds ?? 0;
      const endTime = nextFrame?.timestamp_seconds ?? totalDuration;
      const duration = Math.max(0, endTime - startTime);

      steps.push({
        index: i + 1,
        action: 'frame',
        value: frame.description ?? `Frame ${i + 1}`,
        durationSeconds: parseFloat(duration.toFixed(2)),
        percentOfTotal: totalDuration > 0
          ? parseFloat(((duration / totalDuration) * 100).toFixed(1))
          : 0,
      });
    }
  } else if (report.steps) {
    // Fall back to step definitions with pause durations
    let elapsed = 0;
    for (let i = 0; i < report.steps.length; i++) {
      const step = report.steps[i];
      const pauseMs = parsePause(step.pause ?? '500ms');
      const duration = pauseMs / 1000;

      steps.push({
        index: i + 1,
        action: step.action,
        value: step.value,
        durationSeconds: parseFloat(duration.toFixed(2)),
        percentOfTotal: totalDuration > 0
          ? parseFloat(((duration / totalDuration) * 100).toFixed(1))
          : 0,
      });
      elapsed += duration;
    }
  }

  // Find the slowest step
  const slowestStep = steps.length > 0
    ? steps.reduce((a, b) => (a.durationSeconds >= b.durationSeconds ? a : b))
    : null;

  // Generate optimization suggestions
  const suggestions = generateSuggestions(steps, totalDuration);

  return { scenarioName, totalDurationSeconds: totalDuration, steps, slowestStep, suggestions };
}

/** Generate optimization suggestions based on step timing data. */
function generateSuggestions(steps: StepTiming[], totalDuration: number): string[] {
  const suggestions: string[] = [];

  for (const step of steps) {
    // Long sleep steps
    if (step.action === 'sleep' && step.durationSeconds > 3) {
      suggestions.push(`Step ${step.index}: sleep "${step.value}" takes ${step.durationSeconds}s (${step.percentOfTotal}% of total). Consider reducing to ${Math.max(1, Math.ceil(step.durationSeconds / 2))}s.`);
    }

    // Steps consuming >50% of total time
    if (step.percentOfTotal > 50 && totalDuration > 5) {
      suggestions.push(`Step ${step.index} consumes ${step.percentOfTotal}% of total recording time. Consider splitting or reducing.`);
    }

    // Very long individual steps (>10s)
    if (step.durationSeconds > 10) {
      suggestions.push(`Step ${step.index} takes ${step.durationSeconds}s. Consider breaking into smaller segments.`);
    }
  }

  if (totalDuration > 60) {
    suggestions.push(`Total duration (${totalDuration}s) exceeds 60s. Consider splitting into multiple scenarios.`);
  }

  // Deduplicate
  return [...new Set(suggestions)];
}

/**
 * Render a Unicode bar chart for step timing.
 *
 * @param steps Array of step timings
 * @param maxBarWidth Maximum bar width in characters (default: 30)
 */
export function renderTimingChart(steps: StepTiming[], maxBarWidth = 30): string {
  if (steps.length === 0) return 'No steps to display.';

  const maxDuration = Math.max(...steps.map((s) => s.durationSeconds));
  if (maxDuration === 0) return 'All steps have zero duration.';

  const lines: string[] = [];
  lines.push('Step Timing Analysis');
  lines.push('─'.repeat(50));

  for (const step of steps) {
    const barLen = Math.round((step.durationSeconds / maxDuration) * maxBarWidth);
    const bar = '█'.repeat(Math.max(1, barLen));
    const label = `Step ${step.index}: ${step.action} "${truncate(step.value, 20)}"`;
    lines.push(`${label.padEnd(40)} ${step.durationSeconds.toFixed(1)}s  ${bar}`);
  }

  return lines.join('\n');
}

/**
 * Format a complete timing analysis as a human-readable report.
 */
export function formatTimingReport(analysis: TimingAnalysis): string {
  const lines: string[] = [];

  lines.push(renderTimingChart(analysis.steps));
  lines.push('');
  lines.push(`Total: ${analysis.totalDurationSeconds.toFixed(1)}s`);

  if (analysis.slowestStep) {
    const s = analysis.slowestStep;
    lines.push(`Slowest: Step ${s.index} (${s.action} "${truncate(s.value, 20)}") — ${s.percentOfTotal}% of total`);
  }

  if (analysis.suggestions.length > 0) {
    lines.push('');
    lines.push('Suggestions:');
    for (const suggestion of analysis.suggestions) {
      lines.push(`  💡 ${suggestion}`);
    }
  }

  return lines.join('\n');
}

/** Truncate a string with ellipsis if it exceeds maxLen. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
