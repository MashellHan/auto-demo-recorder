import { resolve, basename } from 'node:path';
import { formatTimestamp } from './index.js';
import { validateDependencies } from './config/dependencies.js';

/**
 * Resolve a user-supplied session/scenario path, stripping the output directory
 * prefix if the user already included it.
 *
 * Examples (outputDir = ".demo-recordings"):
 *   "2026-04-11_08-00/basic"                         → "2026-04-11_08-00/basic"
 *   ".demo-recordings/2026-04-11_08-00/basic"        → "2026-04-11_08-00/basic"
 *   "/abs/path/.demo-recordings/2026-04-11_08-00/b"  → "2026-04-11_08-00/b"
 *
 * This prevents the double-prefix bug where `join(outputDir, userArg)` creates
 * paths like `.demo-recordings/.demo-recordings/...`.
 */
export function resolveSessionPath(outputDir: string, userPath: string): string {
  // Normalize: remove trailing slashes for consistent comparison
  const normalized = userPath.replace(/\/+$/, '');
  const outputDirName = basename(outputDir);

  // Check if the user path starts with the output directory (relative)
  if (normalized.startsWith(outputDirName + '/')) {
    return normalized.slice(outputDirName.length + 1);
  }

  // Check if the user path starts with "./outputDir/"
  if (normalized.startsWith('./' + outputDirName + '/')) {
    return normalized.slice(outputDirName.length + 3);
  }

  // Check if it's an absolute path containing the output dir
  const outputDirSegment = '/' + outputDirName + '/';
  const idx = normalized.indexOf(outputDirSegment);
  if (idx >= 0) {
    return normalized.slice(idx + outputDirSegment.length);
  }

  // No prefix detected — return as-is
  return normalized;
}

/**
 * Validate a config and produce a detailed summary with warnings.
 */
export function validateConfig(config: any): string {
  const lines: string[] = [];
  const warnings: string[] = [];

  lines.push('✓ Config valid');
  lines.push(`  Project: ${config.project.name}`);
  if (config.project.description) {
    lines.push(`  Description: ${config.project.description}`);
  }

  // Scenarios
  const termCount = config.scenarios?.length ?? 0;
  const browserCount = config.browser_scenarios?.length ?? 0;
  lines.push(`  Terminal Scenarios: ${termCount}`);
  lines.push(`  Browser Scenarios: ${browserCount}`);

  // Recording settings
  const rec = config.recording;
  lines.push(`  Recording: ${rec.width}x${rec.height} (${rec.backend})`);
  lines.push(`  Theme: ${rec.theme}`);
  lines.push(`  Format: ${rec.formats?.join(', ') ?? rec.format ?? 'mp4'}`);

  if (rec.backend === 'browser') {
    const b = rec.browser ?? {};
    lines.push(`  Browser: ${b.browser ?? 'chromium'}, viewport ${b.viewport_width ?? 1280}x${b.viewport_height ?? 720}`);
  }

  // Annotation
  lines.push(`  Annotation: ${config.annotation.enabled ? `enabled (${config.annotation.model})` : 'disabled'}`);

  // Output
  lines.push(`  Output: ${config.output.dir}`);

  // Hooks summary
  const allScenarios = [...(config.scenarios ?? []), ...(config.browser_scenarios ?? [])];
  const scenariosWithHooks = allScenarios.filter((s: any) => s.hooks?.before || s.hooks?.after);
  if (scenariosWithHooks.length > 0) {
    lines.push(`  Hooks: ${scenariosWithHooks.length} scenario(s) with lifecycle hooks`);
  }

  // Warnings
  for (const s of allScenarios) {
    const tags = (s as any).tags ?? [];
    if (tags.length === 0) {
      warnings.push(`Scenario "${s.name}" has no tags`);
    }
  }

  if (!rec.idle_time_limit) {
    warnings.push('idle_time_limit not set (default: unlimited)');
  }

  if (config.annotation.enabled && !config.annotation.model) {
    warnings.push('Annotation enabled but no model specified');
  }

  // Validate scenario dependencies
  const depErrors = validateDependencies(allScenarios);
  for (const err of depErrors) {
    warnings.push(err);
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of warnings) {
      lines.push(`  ⚠ ${w}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a dry-run plan summary for a scenario.
 */
export function formatDryRun(
  scenario: { name: string; description: string; steps: { action: string }[]; hooks?: { before?: string; after?: string }; url?: string },
  config: any,
  backend: 'vhs' | 'browser',
): string {
  const lines: string[] = [];
  const timestamp = formatTimestamp(new Date());
  const outputDir = resolve(process.cwd(), config.output.dir, timestamp, scenario.name);

  lines.push(`[DRY RUN] Would record scenario "${scenario.name}":`);
  lines.push(`  Backend: ${backend}`);

  if (backend === 'browser' && scenario.url) {
    lines.push(`  URL: ${scenario.url}`);
  }

  lines.push(`  Format: ${config.recording.formats?.join(', ') ?? config.recording.format ?? 'mp4'}`);
  lines.push(`  Theme: ${config.recording.theme}`);

  // Summarize steps by action type
  const actionCounts = new Map<string, number>();
  for (const step of scenario.steps) {
    actionCounts.set(step.action, (actionCounts.get(step.action) ?? 0) + 1);
  }
  const stepSummary = [...actionCounts.entries()]
    .map(([action, count]) => `${action} x${count}`)
    .join(', ');
  lines.push(`  Steps: ${scenario.steps.length} (${stepSummary})`);

  lines.push(`  Output: ${outputDir}/`);
  lines.push(`  Annotation: ${config.annotation.enabled ? `enabled (${config.annotation.model})` : 'disabled'}`);

  if (scenario.hooks?.before || scenario.hooks?.after) {
    const hookParts: string[] = [];
    if (scenario.hooks.before) hookParts.push(`before: "${scenario.hooks.before}"`);
    if (scenario.hooks.after) hookParts.push(`after: "${scenario.hooks.after}"`);
    lines.push(`  Hooks: ${hookParts.join(', ')}`);
  }

  return lines.join('\n');
}

/** Generate a terminal recording YAML template. */
export function getTerminalTemplate(): string {
  return `project:
  name: my-project
  description: "My CLI/TUI project"
  # build_command: "make build"
  # binary: "./my-project"

recording:
  width: 1200
  height: 800
  font_size: 16
  theme: "Catppuccin Mocha"
  fps: 25
  max_duration: 60
  # format: "mp4"  # or "gif"

output:
  dir: ".demo-recordings"
  keep_raw: true
  keep_frames: false

annotation:
  enabled: true
  model: "claude-sonnet-4-6"
  extract_fps: 1
  language: "en"
  overlay_position: "bottom"
  overlay_font_size: 14

scenarios:
  - name: "basic"
    description: "Basic interaction demo"
    setup: []
    steps:
      - { action: "type", value: "./my-project", pause: "2s" }
      - { action: "key", value: "q", pause: "500ms" }
`;
}

/** Generate a browser recording YAML template. */
export function getBrowserTemplate(): string {
  return `project:
  name: my-web-app
  description: "My web application"
  # build_command: "npm run build"

recording:
  backend: browser
  browser:
    headless: true
    browser: chromium
    viewport_width: 1280
    viewport_height: 720
    timeout_ms: 30000
    device_scale_factor: 1
    record_video: true

output:
  dir: ".demo-recordings"
  keep_raw: true
  keep_frames: false

annotation:
  enabled: true
  model: "claude-sonnet-4-6"
  extract_fps: 1
  language: "en"
  overlay_position: "bottom"
  overlay_font_size: 14

browser_scenarios:
  - name: "homepage"
    description: "Navigate the homepage"
    url: "http://localhost:3000"
    steps:
      - { action: "sleep", value: "2s" }
      - { action: "click", value: "nav a:first-child", pause: "1s" }
      - { action: "scroll", value: "300", pause: "1s" }
      - { action: "screenshot", value: "homepage.png" }
`;
}
