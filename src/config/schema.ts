import { z } from 'zod';

const StepSchema = z.object({
  action: z.enum(['type', 'key', 'sleep', 'screenshot', 'wait', 'assert', 'assert_exit']),
  value: z.string(),
  pause: z.string().default('500ms'),
  repeat: z.number().optional(),
  /** Timeout for wait/assert actions (e.g., "10s"). */
  timeout: z.string().optional(),
  /** Human-readable label for this step, shown in reports and replays. */
  comment: z.string().optional(),
});

/** Browser-specific step schema with extended actions (navigate, click, fill, scroll, hover, select, screenshot). */
const BrowserStepSchema = z.object({
  action: z.enum([
    'navigate', 'click', 'fill', 'type', 'key', 'sleep',
    'scroll', 'hover', 'select', 'screenshot', 'wait',
  ]),
  /** Target value: URL for navigate, CSS selector for click/fill/hover/select, key name for key, text for type/fill, ms for sleep, px for scroll. */
  value: z.string(),
  /** Additional text for fill actions (selector in value, text in text). */
  text: z.string().optional(),
  /** Pause after this step (e.g., "500ms", "2s"). */
  pause: z.string().default('500ms'),
  /** Repeat this step N times. */
  repeat: z.number().optional(),
  /** Human-readable label for this step, shown in reports and replays. */
  comment: z.string().optional(),
});

/** Lifecycle hooks that run shell commands before/after recording. */
const HooksSchema = z.object({
  /** Command to run before recording starts (e.g., "npm run dev &"). */
  before: z.string().optional(),
  /** Command to run after recording finishes (runs even on error). */
  after: z.string().optional(),
}).optional();

const ScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  setup: z.array(z.string()).default([]),
  steps: z.array(StepSchema),
  /** Tags for filtering scenarios (e.g., "smoke", "full", "regression"). */
  tags: z.array(z.string()).default([]),
  /** Lifecycle hooks for setup/teardown commands. */
  hooks: HooksSchema,
  /** Names of scenarios that must be recorded before this one. */
  depends_on: z.array(z.string()).default([]),
});

/** Browser scenario with URL and browser-specific steps. */
const BrowserScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  /** Starting URL for the browser (e.g., "http://localhost:3000"). */
  url: z.string().url(),
  /** Setup commands to run before recording (e.g., start dev server). */
  setup: z.array(z.string()).default([]),
  steps: z.array(BrowserStepSchema),
  /** Tags for filtering scenarios (e.g., "smoke", "full", "regression"). */
  tags: z.array(z.string()).default([]),
  /** Lifecycle hooks for setup/teardown commands. */
  hooks: HooksSchema,
  /** Names of scenarios that must be recorded before this one. */
  depends_on: z.array(z.string()).default([]),
});

const ProjectSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  build_command: z.string().optional(),
  binary: z.string().optional(),
});

/** Browser-specific configuration options. */
const BrowserConfigSchema = z.object({
  /** Run browser in headless mode. */
  headless: z.boolean().default(true),
  /** Browser engine to use. */
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  /** Viewport width in pixels. */
  viewport_width: z.number().default(1280),
  /** Viewport height in pixels. */
  viewport_height: z.number().default(720),
  /** Timeout for each step in milliseconds. */
  timeout_ms: z.number().default(30_000),
  /** Device scale factor for HiDPI rendering. */
  device_scale_factor: z.number().default(1),
  /** Whether to record video (or use screenshots-only mode). */
  record_video: z.boolean().default(true),
});

/** Window frame decoration options for terminal recordings. */
const FrameSchema = z.object({
  /** Window bar style: none, colorful (macOS dots), or rings. */
  style: z.enum(['none', 'colorful', 'rings']).default('none'),
  /** Title text shown in the window bar. */
  title: z.string().optional(),
  /** Window bar size in pixels. */
  bar_size: z.number().optional(),
  /** Border radius in pixels for rounded corners. */
  border_radius: z.number().optional(),
  /** Padding around the terminal content in pixels. */
  padding: z.number().optional(),
});

const RecordingSchema = z.object({
  width: z.number().default(1200),
  height: z.number().default(800),
  font_size: z.number().default(16),
  theme: z.string().default('Catppuccin Mocha'),
  fps: z.number().default(25),
  max_duration: z.number().default(60),
  format: z.enum(['mp4', 'gif', 'svg']).default('mp4'),
  /** Recording backend: 'vhs' for terminal, 'browser' for web UI. */
  backend: z.enum(['vhs', 'browser']).default('vhs'),
  /** Browser-specific configuration (required when backend is 'browser'). */
  browser: BrowserConfigSchema.default({}),
  /** Max idle time in seconds — pauses exceeding this are capped. */
  idle_time_limit: z.number().positive().optional(),
  /** Generate multiple formats in a single pass (overrides format when set). */
  formats: z.array(z.enum(['mp4', 'gif', 'svg'])).optional(),
  /** Window frame decoration. */
  frame: FrameSchema.default({}),
  /** Enable parallel recording of multiple scenarios. */
  parallel: z.boolean().default(false),
  /** Maximum concurrent recordings when parallel is enabled (default: 3). */
  max_workers: z.number().int().min(1).max(16).default(3),
});

const OutputSchema = z.object({
  dir: z.string().default('.demo-recordings'),
  keep_raw: z.boolean().default(true),
  keep_frames: z.boolean().default(false),
  /** Recording retention mode: 'always' keeps all recordings, 'retain-on-failure' deletes clean recordings. */
  record_mode: z.enum(['always', 'retain-on-failure']).default('always'),
  /** Generate an HTML player file alongside recordings. */
  player: z.boolean().default(false),
  /** Generate markdown documentation from recording analysis. */
  docs: z.boolean().default(false),
});

const AnnotationSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string().default('claude-sonnet-4-6'),
  extract_fps: z.number().default(1),
  language: z.string().default('en'),
  overlay_position: z.enum(['top', 'bottom']).default('bottom'),
  overlay_font_size: z.number().default(14),
});

const WatchSchema = z.object({
  include: z.array(z.string()).default(['src/**/*']),
  exclude: z.array(z.string()).default(['node_modules/**', 'dist/**', '.demo-recordings/**']),
  debounce_ms: z.number().default(500),
});

/** Custom recording profile definition in config YAML. */
const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  recording: z.record(z.unknown()).default({}),
  annotation: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
});

export const ConfigSchema = z.object({
  project: ProjectSchema,
  recording: RecordingSchema.default({}),
  output: OutputSchema.default({}),
  annotation: AnnotationSchema.default({}),
  watch: WatchSchema.default({}),
  scenarios: z.array(ScenarioSchema).default([]),
  /** Browser scenarios — used when recording.backend is 'browser'. */
  browser_scenarios: z.array(BrowserScenarioSchema).default([]),
  /** Custom recording profiles defined in config. */
  profiles: z.array(ProfileSchema).default([]),
}).refine(
  (data) => {
    if (data.recording.backend === 'vhs') {
      return data.scenarios.length > 0;
    }
    return data.browser_scenarios.length > 0;
  },
  {
    message: 'At least one scenario is required (use "scenarios" for vhs backend, "browser_scenarios" for browser backend)',
  },
);

export type Config = z.infer<typeof ConfigSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type BrowserScenario = z.infer<typeof BrowserScenarioSchema>;
export type Step = z.infer<typeof StepSchema>;
export type BrowserStep = z.infer<typeof BrowserStepSchema>;
export type RecordingConfig = z.infer<typeof RecordingSchema>;
export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;
export type AnnotationConfig = z.infer<typeof AnnotationSchema>;
export type WatchConfig = z.infer<typeof WatchSchema>;
