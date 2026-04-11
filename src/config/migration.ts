/**
 * Config migration utilities for upgrading demo-recorder.yaml between versions.
 *
 * Detects outdated config patterns and applies automatic migrations with
 * human-readable descriptions of what changed.
 */

/** Description of a single migration step applied to a config. */
export interface MigrationStep {
  /** Human-readable description of what changed. */
  description: string;
  /** Config path that was modified (e.g., "recording.format"). */
  path: string;
  /** Old value (if applicable). */
  oldValue?: unknown;
  /** New value (if applicable). */
  newValue?: unknown;
}

/** Result of migrating a config object. */
export interface MigrationResult {
  /** The migrated config object. */
  config: Record<string, unknown>;
  /** Steps that were applied. */
  steps: MigrationStep[];
  /** Whether any changes were made. */
  changed: boolean;
}

/**
 * Migrate a raw (pre-validation) config object to the latest schema version.
 *
 * Applies a series of migration rules to handle deprecated fields,
 * renamed properties, and structural changes. Non-destructive: returns
 * a new config object without modifying the original.
 */
export function migrateConfig(raw: Record<string, unknown>): MigrationResult {
  const config = structuredClone(raw);
  const steps: MigrationStep[] = [];

  // Migration 1: Rename "terminal_scenarios" → "scenarios"
  if ('terminal_scenarios' in config && !('scenarios' in config)) {
    config.scenarios = config.terminal_scenarios;
    delete config.terminal_scenarios;
    steps.push({
      description: 'Renamed "terminal_scenarios" to "scenarios"',
      path: 'scenarios',
      oldValue: 'terminal_scenarios',
      newValue: 'scenarios',
    });
  }

  // Migration 2: Move top-level "theme" to "recording.theme"
  if ('theme' in config) {
    const recording = (config.recording ?? {}) as Record<string, unknown>;
    if (!('theme' in recording)) {
      recording.theme = config.theme;
      config.recording = recording;
    }
    delete config.theme;
    steps.push({
      description: 'Moved top-level "theme" to "recording.theme"',
      path: 'recording.theme',
      oldValue: config.theme,
      newValue: (config.recording as Record<string, unknown>).theme,
    });
  }

  // Migration 3: Convert "format" at top level to "recording.format"
  if ('format' in config) {
    const recording = (config.recording ?? {}) as Record<string, unknown>;
    if (!('format' in recording)) {
      recording.format = config.format;
      config.recording = recording;
    }
    delete config.format;
    steps.push({
      description: 'Moved top-level "format" to "recording.format"',
      path: 'recording.format',
    });
  }

  // Migration 4: Rename "ai" section to "annotation"
  if ('ai' in config && !('annotation' in config)) {
    config.annotation = config.ai;
    delete config.ai;
    steps.push({
      description: 'Renamed "ai" section to "annotation"',
      path: 'annotation',
    });
  }

  // Migration 5: Convert recording.framerate → recording.fps
  const recording = config.recording as Record<string, unknown> | undefined;
  if (recording && 'framerate' in recording) {
    if (!('fps' in recording)) {
      recording.fps = recording.framerate;
    }
    delete recording.framerate;
    steps.push({
      description: 'Renamed "recording.framerate" to "recording.fps"',
      path: 'recording.fps',
      oldValue: 'framerate',
      newValue: 'fps',
    });
  }

  // Migration 6: Convert recording.output_dir → output.dir
  if (recording && 'output_dir' in recording) {
    const output = (config.output ?? {}) as Record<string, unknown>;
    if (!('dir' in output)) {
      output.dir = recording.output_dir;
      config.output = output;
    }
    delete recording.output_dir;
    steps.push({
      description: 'Moved "recording.output_dir" to "output.dir"',
      path: 'output.dir',
    });
  }

  // Migration 7: Convert annotation.model "gpt-4-vision" to default
  const annotation = config.annotation as Record<string, unknown> | undefined;
  if (annotation && annotation.model === 'gpt-4-vision') {
    annotation.model = 'claude-sonnet-4-6';
    steps.push({
      description: 'Updated deprecated annotation model "gpt-4-vision" to "claude-sonnet-4-6"',
      path: 'annotation.model',
      oldValue: 'gpt-4-vision',
      newValue: 'claude-sonnet-4-6',
    });
  }

  // Migration 8: Add default depends_on to scenarios without it
  const scenarios = config.scenarios as Array<Record<string, unknown>> | undefined;
  if (scenarios) {
    let migrated = false;
    for (const scenario of scenarios) {
      if (!('depends_on' in scenario)) {
        scenario.depends_on = [];
        migrated = true;
      }
    }
    if (migrated) {
      steps.push({
        description: 'Added default "depends_on: []" to scenarios missing it',
        path: 'scenarios[].depends_on',
      });
    }
  }

  const browserScenarios = config.browser_scenarios as Array<Record<string, unknown>> | undefined;
  if (browserScenarios) {
    let migrated = false;
    for (const scenario of browserScenarios) {
      if (!('depends_on' in scenario)) {
        scenario.depends_on = [];
        migrated = true;
      }
    }
    if (migrated) {
      steps.push({
        description: 'Added default "depends_on: []" to browser scenarios missing it',
        path: 'browser_scenarios[].depends_on',
      });
    }
  }

  return { config, steps, changed: steps.length > 0 };
}

/**
 * Format a migration result as a human-readable report.
 */
export function formatMigrationReport(result: MigrationResult): string {
  if (!result.changed) {
    return '✓ Config is up to date — no migrations needed.';
  }

  const lines: string[] = [];
  lines.push(`Config Migration Report`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`${result.steps.length} migration(s) applied:\n`);

  for (let i = 0; i < result.steps.length; i++) {
    const step = result.steps[i];
    lines.push(`  ${i + 1}. ${step.description}`);
    if (step.oldValue !== undefined) {
      lines.push(`     Old: ${JSON.stringify(step.oldValue)}`);
    }
    if (step.newValue !== undefined) {
      lines.push(`     New: ${JSON.stringify(step.newValue)}`);
    }
  }

  return lines.join('\n');
}
