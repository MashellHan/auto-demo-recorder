/**
 * Config linter — opinionated best-practice rules beyond schema validation.
 *
 * While the schema validator checks structural correctness, the linter
 * applies domain-specific rules that catch common misconfigurations.
 */

import type { Config } from './schema.js';
import { getThemeNames } from './themes.js';

/** Severity of a lint warning. */
export type LintSeverity = 'error' | 'warning' | 'info';

/** A single lint finding. */
export interface LintWarning {
  /** Severity level. */
  readonly severity: LintSeverity;
  /** Rule identifier (e.g., "high-fps", "no-scenarios"). */
  readonly rule: string;
  /** Human-readable description. */
  readonly message: string;
  /** Optional suggestion for fixing the issue. */
  readonly suggestion?: string;
}

/** Complete lint result. */
export interface LintResult {
  /** All warnings found. */
  readonly warnings: readonly LintWarning[];
  /** Number of errors. */
  readonly errors: number;
  /** Number of warnings. */
  readonly warningCount: number;
  /** Number of info items. */
  readonly infoCount: number;
  /** Whether the config passes all error-level rules. */
  readonly passed: boolean;
}

/**
 * Run all lint rules against a config.
 */
export function lintConfig(config: Config): LintResult {
  const warnings: LintWarning[] = [];

  checkNoScenarios(config, warnings);
  checkDuplicateScenarioNames(config, warnings);
  checkHighFps(config, warnings);
  checkShortMaxDuration(config, warnings);
  checkAnnotationWithoutModel(config, warnings);
  checkUnknownTheme(config, warnings);
  checkLargeScenarioCount(config, warnings);

  const errors = warnings.filter((w) => w.severity === 'error').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;
  const infoCount = warnings.filter((w) => w.severity === 'info').length;

  return {
    warnings,
    errors,
    warningCount,
    infoCount,
    passed: errors === 0,
  };
}

function checkNoScenarios(config: Config, warnings: LintWarning[]): void {
  const total = config.scenarios.length + config.browser_scenarios.length;
  if (total === 0) {
    warnings.push({
      severity: 'error',
      rule: 'no-scenarios',
      message: 'No scenarios defined. At least one scenario is required for recording.',
      suggestion: 'Add a scenario under `scenarios:` or `browser_scenarios:` in your config.',
    });
  }
}

function checkDuplicateScenarioNames(config: Config, warnings: LintWarning[]): void {
  const names = [
    ...config.scenarios.map((s) => s.name),
    ...config.browser_scenarios.map((s) => s.name),
  ];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) {
      warnings.push({
        severity: 'error',
        rule: 'duplicate-scenario-name',
        message: `Duplicate scenario name "${name}".`,
        suggestion: 'Each scenario must have a unique name.',
      });
    }
    seen.add(name);
  }
}

function checkHighFps(config: Config, warnings: LintWarning[]): void {
  if (config.annotation.extract_fps > 30) {
    warnings.push({
      severity: 'warning',
      rule: 'high-fps',
      message: `Annotation FPS is ${config.annotation.extract_fps}. Values above 30 are wasteful for most demos.`,
      suggestion: 'Consider setting annotation.extract_fps to 2-10 for cost efficiency.',
    });
  }
}

function checkShortMaxDuration(config: Config, warnings: LintWarning[]): void {
  if (config.recording.max_duration < 10) {
    warnings.push({
      severity: 'warning',
      rule: 'short-max-duration',
      message: `Max duration is ${config.recording.max_duration}s. Short durations may truncate recordings.`,
      suggestion: 'Consider setting recording.max_duration to at least 30s.',
    });
  }
}

function checkAnnotationWithoutModel(config: Config, warnings: LintWarning[]): void {
  if (config.annotation.enabled && !config.annotation.model) {
    warnings.push({
      severity: 'info',
      rule: 'no-annotation-model',
      message: 'Annotation is enabled but no model is specified. Default model will be used.',
      suggestion: 'Set annotation.model to explicitly choose the AI model.',
    });
  }
}

function checkUnknownTheme(config: Config, warnings: LintWarning[]): void {
  const theme = config.recording.theme;
  if (theme) {
    const known = getThemeNames();
    const themeLC = theme.toLowerCase();
    if (!known.some((k) => k.toLowerCase() === themeLC)) {
      warnings.push({
        severity: 'info',
        rule: 'unknown-theme',
        message: `Theme "${theme}" is not in the known theme list.`,
        suggestion: `Available themes: ${known.slice(0, 5).join(', ')}... (use 'demo-recorder themes' to see all).`,
      });
    }
  }
}

function checkLargeScenarioCount(config: Config, warnings: LintWarning[]): void {
  const total = config.scenarios.length + config.browser_scenarios.length;
  if (total > 20) {
    warnings.push({
      severity: 'info',
      rule: 'many-scenarios',
      message: `${total} scenarios defined. Consider using tags and --tag filter for selective recording.`,
    });
  }
}

/**
 * Format lint result as a human-readable report.
 */
export function formatLintReport(result: LintResult): string {
  if (result.warnings.length === 0) {
    return 'Config Lint: All checks passed.';
  }

  const lines: string[] = [];
  lines.push('Config Lint Report');
  lines.push('═'.repeat(50));
  lines.push('');

  for (const w of result.warnings) {
    const icon = w.severity === 'error' ? '✗' : w.severity === 'warning' ? '⚠' : 'ℹ';
    lines.push(`  ${icon} [${w.severity.toUpperCase()}] ${w.rule}: ${w.message}`);
    if (w.suggestion) {
      lines.push(`    → ${w.suggestion}`);
    }
    lines.push('');
  }

  lines.push(`Summary: ${result.errors} errors, ${result.warningCount} warnings, ${result.infoCount} info`);
  if (result.passed) {
    lines.push('Result: PASS (no errors)');
  } else {
    lines.push('Result: FAIL (errors found)');
  }

  return lines.join('\n');
}
