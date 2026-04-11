import type { Config, Scenario, Step } from './schema.js';

export interface AdhocOptions {
  command: string;
  steps?: Step[];
  width?: number;
  height?: number;
  format?: 'mp4' | 'gif';
  annotate?: boolean;
}

export function buildAdhocConfig(opts: AdhocOptions): Config {
  return {
    project: {
      name: 'adhoc-recording',
      description: `Ad-hoc recording: ${opts.command}`,
    },
    recording: {
      width: opts.width ?? 1200,
      height: opts.height ?? 800,
      font_size: 16,
      theme: 'Catppuccin Mocha',
      fps: 25,
      max_duration: 60,
      format: opts.format === 'gif' ? 'gif' : 'mp4',
    },
    output: {
      dir: '.demo-recordings',
      keep_raw: true,
      keep_frames: false,
    },
    annotation: {
      enabled: opts.annotate !== false,
      model: 'claude-sonnet-4-6',
      extract_fps: 1,
      language: 'en',
      overlay_position: 'bottom',
      overlay_font_size: 14,
    },
    watch: {
      include: ['src/**/*'],
      exclude: ['node_modules/**', 'dist/**', '.demo-recordings/**'],
      debounce_ms: 500,
    },
    scenarios: [],
  };
}

export function buildAdhocScenario(command: string, steps?: Step[]): Scenario {
  const allSteps: Step[] = [
    { action: 'type', value: command, pause: '2s' },
  ];
  if (steps) {
    allSteps.push(...steps);
  }
  return {
    name: 'adhoc',
    description: `Ad-hoc: ${command}`,
    setup: [],
    steps: allSteps,
  };
}
