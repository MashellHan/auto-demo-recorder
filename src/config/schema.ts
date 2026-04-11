import { z } from 'zod';

const StepSchema = z.object({
  action: z.enum(['type', 'key', 'sleep']),
  value: z.string(),
  pause: z.string().default('500ms'),
  repeat: z.number().optional(),
});

const ScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  setup: z.array(z.string()).default([]),
  steps: z.array(StepSchema),
});

const ProjectSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  build_command: z.string().optional(),
  binary: z.string().optional(),
});

const RecordingSchema = z.object({
  width: z.number().default(1200),
  height: z.number().default(800),
  font_size: z.number().default(16),
  theme: z.string().default('Catppuccin Mocha'),
  fps: z.number().default(25),
  max_duration: z.number().default(60),
  format: z.enum(['mp4', 'gif']).default('mp4'),
});

const OutputSchema = z.object({
  dir: z.string().default('.demo-recordings'),
  keep_raw: z.boolean().default(true),
  keep_frames: z.boolean().default(false),
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

export const ConfigSchema = z.object({
  project: ProjectSchema,
  recording: RecordingSchema.default({}),
  output: OutputSchema.default({}),
  annotation: AnnotationSchema.default({}),
  watch: WatchSchema.default({}),
  scenarios: z.array(ScenarioSchema).min(1),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Step = z.infer<typeof StepSchema>;
export type RecordingConfig = z.infer<typeof RecordingSchema>;
export type AnnotationConfig = z.infer<typeof AnnotationSchema>;
export type WatchConfig = z.infer<typeof WatchSchema>;
