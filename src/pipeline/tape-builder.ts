import type { Scenario, RecordingConfig } from '../config/schema.js';

export interface TapeBuildOptions {
  scenario: Scenario;
  recording: RecordingConfig;
  outputPath: string;
}

export function buildTape(options: TapeBuildOptions): string {
  const { scenario, recording, outputPath } = options;
  const lines: string[] = [];

  lines.push(`# Auto-generated from scenario: ${scenario.name}`);
  lines.push(`Output "${outputPath}"`);
  lines.push(`Set Width ${recording.width}`);
  lines.push(`Set Height ${recording.height}`);
  lines.push(`Set FontSize ${recording.font_size}`);
  lines.push(`Set Theme "${recording.theme}"`);
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
          lines.push(`Sleep ${step.value}`);
          continue; // sleep action uses value as duration, skip the default pause
        case 'screenshot':
          lines.push(`Screenshot "${escapeQuotes(step.value)}"`);
          continue; // screenshot doesn't need a trailing pause
      }
      lines.push(`Sleep ${step.pause}`);
    }
  }

  return lines.join('\n') + '\n';
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
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
