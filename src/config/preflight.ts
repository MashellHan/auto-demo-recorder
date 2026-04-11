/**
 * Pre-flight check — combines config validation, linting, and health check
 * into a single comprehensive command.
 *
 * Runs in order:
 * 1. Config validation (schema check)
 * 2. Config lint (best-practice rules)
 * 3. Health check (tool availability)
 *
 * Returns a unified pass/fail result with all findings.
 */

import type { Config } from './schema.js';
import type { LintResult } from './linter.js';
import type { HealthCheckResult } from '../pipeline/health-check.js';

/** Individual pre-flight check result. */
export interface PreflightCheck {
  /** Check name. */
  readonly name: string;
  /** Whether the check passed. */
  readonly passed: boolean;
  /** Human-readable summary line. */
  readonly summary: string;
  /** Detailed findings (if any). */
  readonly details: readonly string[];
}

/** Complete pre-flight check result. */
export interface PreflightResult {
  /** All checks performed. */
  readonly checks: readonly PreflightCheck[];
  /** Whether all checks passed. */
  readonly passed: boolean;
  /** Total number of issues found. */
  readonly totalIssues: number;
  /** Duration in milliseconds. */
  readonly durationMs: number;
}

/**
 * Run all pre-flight checks against a config.
 */
export async function runPreflightChecks(
  config: Config,
  projectDir: string,
  backend: 'vhs' | 'browser' = 'vhs',
): Promise<PreflightResult> {
  const startMs = Date.now();
  const checks: PreflightCheck[] = [];

  // 1. Config validation (always passes since config is already parsed)
  checks.push(buildValidationCheck(config));

  // 2. Config lint
  const { lintConfig } = await import('./linter.js');
  const lintResult = lintConfig(config);
  checks.push(buildLintCheck(lintResult));

  // 3. Health check
  const { runHealthCheck } = await import('../pipeline/health-check.js');
  const healthResult = await runHealthCheck(projectDir, backend);
  checks.push(buildHealthCheck(healthResult));

  const durationMs = Date.now() - startMs;
  const totalIssues = checks.reduce((sum, c) => sum + c.details.length, 0);
  const passed = checks.every((c) => c.passed);

  return { checks, passed, totalIssues, durationMs };
}

function buildValidationCheck(config: Config): PreflightCheck {
  const scenarioCount = config.scenarios.length + config.browser_scenarios.length;
  const details: string[] = [];

  if (scenarioCount === 0) {
    details.push('No scenarios defined');
  }

  return {
    name: 'Config Validation',
    passed: scenarioCount > 0,
    summary: `${scenarioCount} scenarios, backend: ${config.recording.backend}`,
    details,
  };
}

function buildLintCheck(result: LintResult): PreflightCheck {
  const details: string[] = [];

  for (const w of result.warnings) {
    const icon = w.severity === 'error' ? '✗' : w.severity === 'warning' ? '⚠' : 'ℹ';
    details.push(`${icon} [${w.severity.toUpperCase()}] ${w.rule}: ${w.message}`);
  }

  return {
    name: 'Config Lint',
    passed: result.passed,
    summary: `${result.errors} errors, ${result.warningCount} warnings, ${result.infoCount} info`,
    details,
  };
}

function buildHealthCheck(result: HealthCheckResult): PreflightCheck {
  const details: string[] = [];

  for (const item of result.items) {
    if (item.status !== 'ok') {
      details.push(`✗ ${item.name}: ${item.message ?? 'not available'}`);
    }
  }

  const passedCount = result.items.filter((i) => i.status === 'ok').length;

  return {
    name: 'Health Check',
    passed: result.allPassed,
    summary: `${passedCount}/${result.items.length} tools available`,
    details,
  };
}

/**
 * Format pre-flight result as a human-readable report.
 */
export function formatPreflightReport(result: PreflightResult): string {
  const lines: string[] = [];
  lines.push('Pre-flight Check');
  lines.push('═'.repeat(50));
  lines.push('');

  for (const check of result.checks) {
    const icon = check.passed ? '✓' : '✗';
    lines.push(`  ${icon} ${check.name}: ${check.summary}`);
    for (const detail of check.details) {
      lines.push(`      ${detail}`);
    }
  }

  lines.push('');
  lines.push(`Duration: ${result.durationMs}ms`);

  if (result.passed) {
    lines.push('Result: ALL CHECKS PASSED');
  } else {
    lines.push(`Result: FAILED (${result.totalIssues} issues found)`);
  }

  return lines.join('\n');
}
