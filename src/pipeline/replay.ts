/** A single step in a replay plan. */
export interface ReplayStep {
  /** Frame number in the original recording. */
  frameNumber: number;
  /** Timestamp in seconds from the start of the recording. */
  timestampSeconds: number;
  /** AI-generated description of what's happening in this frame. */
  description: string;
  /** Whether a bug was detected in this frame. */
  hasBug: boolean;
  /** Description of the bug, if any. */
  bugDescription?: string;
  /** Delay in milliseconds before showing this step (based on original timing). */
  delayMs: number;
}

/** A complete replay plan for a recorded session. */
export interface ReplayPlan {
  /** Name of the recorded scenario. */
  scenarioName: string;
  /** Total number of steps. */
  totalSteps: number;
  /** Overall recording status. */
  status: string;
  /** Total duration of the original recording. */
  durationSeconds: number;
  /** Total bugs found. */
  bugsFound: number;
  /** Ordered list of replay steps. */
  steps: ReplayStep[];
}

/** Report frame structure from the recording analysis. */
interface ReportFrame {
  frame_number: number;
  timestamp_seconds: number;
  description: string;
  bugs_detected?: boolean;
  bug_description?: string;
}

/** Minimal report structure for replay. */
interface Report {
  scenario: string;
  frames: ReportFrame[];
  overall_status: string;
  total_frames_analyzed: number;
  bugs_found: number;
  duration_seconds: number;
}

/**
 * Build a replay plan from a recording report.
 * Calculates timing deltas between frames for accurate replay pacing.
 */
export function buildReplayPlan(report: Report): ReplayPlan {
  const steps: ReplayStep[] = report.frames.map((frame, idx) => {
    const prevTimestamp = idx > 0 ? report.frames[idx - 1].timestamp_seconds : frame.timestamp_seconds;
    const delayMs = Math.round((frame.timestamp_seconds - prevTimestamp) * 1000);

    return {
      frameNumber: frame.frame_number,
      timestampSeconds: frame.timestamp_seconds,
      description: frame.description,
      hasBug: frame.bugs_detected ?? false,
      bugDescription: frame.bug_description,
      delayMs: Math.max(0, delayMs),
    };
  });

  return {
    scenarioName: report.scenario,
    totalSteps: steps.length,
    status: report.overall_status,
    durationSeconds: report.duration_seconds,
    bugsFound: report.bugs_found,
    steps,
  };
}

/**
 * Format a single replay step as a human-readable string.
 */
export function formatReplayStep(step: ReplayStep, totalSteps: number): string {
  const lines: string[] = [];
  const stepLabel = `Step ${step.frameNumber}/${totalSteps}`;
  const timeLabel = `${step.timestampSeconds.toFixed(1)}s`;

  lines.push(`[${stepLabel}] (${timeLabel})`);
  lines.push(`  ${step.description}`);

  if (step.hasBug) {
    lines.push(`  [BUG] ${step.bugDescription ?? 'Bug detected'}`);
  }

  return lines.join('\n');
}

/**
 * Format a replay plan header.
 */
export function formatReplayHeader(plan: ReplayPlan): string {
  const lines: string[] = [];
  lines.push(`[Replay] ${plan.scenarioName}`);
  lines.push(`  Status: ${plan.status}`);
  lines.push(`  Duration: ${plan.durationSeconds.toFixed(1)}s`);
  lines.push(`  Frames: ${plan.totalSteps}`);
  lines.push(`  Bugs: ${plan.bugsFound}`);
  lines.push('');
  return lines.join('\n');
}
