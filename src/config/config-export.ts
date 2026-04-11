/**
 * Config export — serialize a parsed Config to JSON or
 * a simplified TOML-like format.
 *
 * Useful for sharing configs across tools, debugging
 * parsed values, and generating machine-readable output.
 */

import type { Config } from './schema.js';

/** Export format. */
export type ExportFormat = 'json' | 'toml';

/** Export result. */
export interface ConfigExport {
  /** The format used. */
  readonly format: ExportFormat;
  /** Serialized config content. */
  readonly content: string;
  /** Number of scenarios included. */
  readonly scenarioCount: number;
}

/**
 * Export a parsed config object to the specified format.
 */
export function exportConfig(config: Config, format: ExportFormat): ConfigExport {
  const scenarioCount = config.scenarios.length + config.browser_scenarios.length;

  if (format === 'json') {
    return {
      format: 'json',
      content: JSON.stringify(config, null, 2),
      scenarioCount,
    };
  }

  return {
    format: 'toml',
    content: toToml(config),
    scenarioCount,
  };
}

/**
 * Convert a config object to a simplified TOML-like format.
 */
function toToml(config: Config): string {
  const lines: string[] = [];

  // [project]
  lines.push('[project]');
  lines.push(`name = "${config.project.name}"`);
  lines.push(`description = "${config.project.description}"`);
  lines.push('');

  // [recording]
  lines.push('[recording]');
  lines.push(`width = ${config.recording.width}`);
  lines.push(`height = ${config.recording.height}`);
  lines.push(`fps = ${config.recording.fps}`);
  lines.push(`parallel = ${config.recording.parallel}`);
  lines.push(`max_workers = ${config.recording.max_workers}`);
  if (config.recording.theme) {
    lines.push(`theme = "${config.recording.theme}"`);
  }
  lines.push('');

  // [output]
  lines.push('[output]');
  lines.push(`dir = "${config.output.dir}"`);
  lines.push('');

  // [annotation]
  lines.push('[annotation]');
  lines.push(`enabled = ${config.annotation.enabled}`);
  if (config.annotation.model) {
    lines.push(`model = "${config.annotation.model}"`);
  }
  lines.push('');

  // [[scenarios]]
  for (const s of config.scenarios) {
    lines.push('[[scenarios]]');
    lines.push(`name = "${s.name}"`);
    lines.push(`description = "${s.description}"`);
    if (s.tags && s.tags.length > 0) {
      lines.push(`tags = [${s.tags.map((t) => `"${t}"`).join(', ')}]`);
    }
    if (s.depends_on && s.depends_on.length > 0) {
      lines.push(`depends_on = [${s.depends_on.map((d) => `"${d}"`).join(', ')}]`);
    }
    lines.push(`steps = ${s.steps.length} # step details omitted`);
    lines.push('');
  }

  // [[browser_scenarios]]
  for (const s of config.browser_scenarios) {
    lines.push('[[browser_scenarios]]');
    lines.push(`name = "${s.name}"`);
    lines.push(`description = "${s.description}"`);
    lines.push(`url = "${s.url}"`);
    if (s.tags && s.tags.length > 0) {
      lines.push(`tags = [${s.tags.map((t) => `"${t}"`).join(', ')}]`);
    }
    lines.push(`steps = ${s.steps.length} # step details omitted`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format export result summary.
 */
export function formatExportSummary(result: ConfigExport): string {
  const lines: string[] = [];
  lines.push(`Config exported as ${result.format.toUpperCase()}`);
  lines.push(`Scenarios: ${result.scenarioCount}`);
  lines.push(`Size: ${result.content.length} bytes`);
  return lines.join('\n');
}
