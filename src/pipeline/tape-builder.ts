import type { Scenario, RecordingConfig } from '../config/schema.js';

export interface TapeBuildOptions {
  scenario: Scenario;
  recording: RecordingConfig;
  outputPath: string;
  /** Additional output paths for multi-format recording. */
  extraOutputPaths?: string[];
}

export function buildTape(options: TapeBuildOptions): string {
  const { scenario, recording, outputPath, extraOutputPaths = [] } = options;
  const idleLimit = recording.idle_time_limit;
  const lines: string[] = [];

  lines.push(`# Auto-generated from scenario: ${scenario.name}`);
  lines.push(`Output "${outputPath}"`);
  for (const extra of extraOutputPaths) {
    lines.push(`Output "${extra}"`);
  }
  lines.push(`Set Width ${recording.width}`);
  lines.push(`Set Height ${recording.height}`);
  lines.push(`Set FontSize ${recording.font_size}`);
  lines.push(`Set Theme "${recording.theme}"`);

  // Window frame decorations
  const frame = recording.frame ?? { style: 'none' as const };
  if (frame.style !== 'none') {
    lines.push(`Set WindowBar "${frame.style}"`);
  }
  if (frame.title) {
    lines.push(`Set WindowBarSize ${frame.bar_size ?? 40}`);
    lines.push(`Set WindowTitle "${escapeQuotes(frame.title)}"`);
  } else if (frame.bar_size) {
    lines.push(`Set WindowBarSize ${frame.bar_size}`);
  }
  if (frame.border_radius) {
    lines.push(`Set BorderRadius ${frame.border_radius}`);
  }
  if (frame.padding) {
    lines.push(`Set Padding ${frame.padding}`);
  }

  lines.push('');

  // Setup phase (hidden)
  if (scenario.setup.length > 0) {
    lines.push('# Setup phase (hidden)');
    lines.push('Hide');
    for (const cmd of scenario.setup) {
      lines.push(`Type "${escapeQuotes(cmd)}"`);
      lines.push('Enter');
      lines.push('Sleep 500ms');
    }
    lines.push('Show');
    lines.push('');
  }

  // Recording phase
  lines.push('# Recording phase');
  for (const step of scenario.steps) {
    const repeatCount = step.repeat ?? 1;
    for (let i = 0; i < repeatCount; i++) {
      switch (step.action) {
        case 'type':
          lines.push(`Type "${escapeQuotes(step.value)}"`);
          lines.push('Enter');
          break;
        case 'key':
          lines.push(mapKey(step.value));
          break;
        case 'sleep':
          lines.push(`Sleep ${capDuration(step.value, idleLimit)}`);
          continue; // sleep action uses value as duration, skip the default pause
        case 'screenshot':
          lines.push(`Screenshot "${escapeQuotes(step.value)}"`);
          continue; // screenshot doesn't need a trailing pause
        case 'wait': {
          const waitTimeout = step.timeout ?? '10s';
          lines.push(`Wait+Screen /${escapeRegex(step.value)}/ ${waitTimeout}`);
          break;
        }
        case 'assert': {
          const assertTimeout = step.timeout ?? '10s';
          lines.push(`Wait+Screen /${escapeRegex(step.value)}/ ${assertTimeout}`);
          break;
        }
        case 'assert_exit':
          lines.push(`Type "echo $?"`);
          lines.push('Enter');
          lines.push(`Wait+Screen /${escapeRegex(step.value)}/ ${step.timeout ?? '5s'}`);
          break;
      }
      lines.push(`Sleep ${capDuration(step.pause, idleLimit)}`);
    }
  }

  return lines.join('\n') + '\n';
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

/** Escape forward slashes in regex patterns for VHS Wait+Screen directives. */
function escapeRegex(s: string): string {
  return s.replace(/\//g, '\\/');
}

/** Cap a duration string (e.g. "10s", "3000ms") to a maximum number of seconds. */
function capDuration(duration: string, limitSeconds?: number): string {
  if (!limitSeconds) return duration;
  const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
  if (!match) return duration;
  const value = parseFloat(match[1]);
  const unit = match[2];
  const seconds = unit === 'ms' ? value / 1000 : value;
  if (seconds <= limitSeconds) return duration;
  return `${limitSeconds}s`;
}

function mapKey(key: string): string {
  const lower = key.toLowerCase();
  switch (lower) {
    case 'enter':
      return 'Enter';
    case 'tab':
      return 'Tab';
    case 'escape':
    case 'esc':
      return 'Escape';
    case 'backspace':
      return 'Backspace';
    case 'up':
      return 'Up';
    case 'down':
      return 'Down';
    case 'left':
      return 'Left';
    case 'right':
      return 'Right';
    case 'space':
      return 'Space';
    default:
      // Single character keys like j, k, q, /
      return `Type "${escapeQuotes(key)}"`;
  }
}
