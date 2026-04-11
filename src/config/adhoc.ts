import type { Config, Scenario, Step } from './schema.js';
import { resolveThemeId } from './themes.js';

export interface AdhocOptions {
  command: string;
  steps?: Step[];
  width?: number;
  height?: number;
  format?: 'mp4' | 'gif';
  annotate?: boolean;
  /** Recording backend: 'vhs' for terminal (default), 'browser' for web UI. */
  backend?: 'vhs' | 'browser';
  /** Override recording theme (e.g., "Dracula", "Nord"). */
  theme?: string;
}

export function buildAdhocConfig(opts: AdhocOptions): Config {
  const isBrowser = opts.backend === 'browser';

  return {
    project: {
      name: 'adhoc-recording',
      description: `Ad-hoc recording: ${opts.command}`,
    },
    recording: {
      width: opts.width ?? 1200,
      height: opts.height ?? 800,
      font_size: 16,
      theme: opts.theme ? resolveThemeId(opts.theme) : 'Catppuccin Mocha',
      fps: 25,
      max_duration: 60,
      format: opts.format === 'gif' ? 'gif' : 'mp4',
      backend: isBrowser ? 'browser' : 'vhs',
      browser: {
        headless: true,
        browser: 'chromium',
        viewport_width: opts.width ?? 1280,
        viewport_height: opts.height ?? 720,
        timeout_ms: 30_000,
        device_scale_factor: 1,
        record_video: true,
      },
      frame: { style: 'none' },
    },
    output: {
      dir: '.demo-recordings',
      keep_raw: true,
      keep_frames: false,
      record_mode: 'always',
      player: false,
      docs: false,
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
    scenarios: isBrowser ? [] : [{ name: 'adhoc', description: `Ad-hoc: ${opts.command}`, setup: [], steps: [], tags: [] }],
    browser_scenarios: isBrowser
      ? [{ name: 'adhoc-browser', description: `Ad-hoc browser: ${opts.command}`, url: opts.command, setup: [], steps: [], tags: [] }]
      : [],
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
    tags: [],
  };
}
