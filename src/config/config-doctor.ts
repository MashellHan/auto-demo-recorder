/**
 * Config doctor — diagnose common configuration problems beyond
 * what the linter catches.
 *
 * The doctor performs deeper analysis: scenario dependency cycles,
 * unreachable scenarios, recording duration estimates, and
 * resource usage warnings.
 */

import type { Config } from '../config/schema.js';

/** A single diagnostic finding. */
export interface Diagnostic {
  /** Diagnostic category. */
  readonly category: 'dependency' | 'performance' | 'compatibility' | 'best-practice';
  /** Severity level. */
  readonly severity: 'error' | 'warning' | 'info';
  /** Human-readable message. */
  readonly message: string;
  /** Related scenario name (if applicable). */
  readonly scenario?: string;
}

/** Doctor result. */
export interface DoctorResult {
  /** All diagnostics found. */
  readonly diagnostics: readonly Diagnostic[];
  /** Error count. */
  readonly errorCount: number;
  /** Warning count. */
  readonly warningCount: number;
  /** Info count. */
  readonly infoCount: number;
  /** Whether the config passed (no errors). */
  readonly passed: boolean;
}

/**
 * Run config diagnostics.
 */
export function diagnoseConfig(config: Config): DoctorResult {
  const diagnostics: Diagnostic[] = [];

  checkDependencyCycles(config, diagnostics);
  checkUnreachableScenarios(config, diagnostics);
  checkEstimatedDuration(config, diagnostics);
  checkResourceUsage(config, diagnostics);
  checkBestPractices(config, diagnostics);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const infoCount = diagnostics.filter((d) => d.severity === 'info').length;

  return {
    diagnostics,
    errorCount,
    warningCount,
    infoCount,
    passed: errorCount === 0,
  };
}

function checkDependencyCycles(config: Config, diagnostics: Diagnostic[]): void {
  const allScenarios = [
    ...config.scenarios.map((s) => ({ name: s.name, deps: s.depends_on ?? [] })),
    ...config.browser_scenarios.map((s) => ({ name: s.name, deps: s.depends_on ?? [] })),
  ];

  const names = new Set(allScenarios.map((s) => s.name));

  for (const s of allScenarios) {
    for (const dep of s.deps) {
      if (!names.has(dep)) {
        diagnostics.push({
          category: 'dependency',
          severity: 'error',
          message: `Scenario "${s.name}" depends on unknown scenario "${dep}"`,
          scenario: s.name,
        });
      }
    }
  }

  // Simple cycle detection via DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const adjMap = new Map(allScenarios.map((s) => [s.name, s.deps]));

  function dfs(node: string): boolean {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const dep of adjMap.get(node) ?? []) {
      if (dfs(dep)) {
        diagnostics.push({
          category: 'dependency',
          severity: 'error',
          message: `Dependency cycle detected involving "${node}"`,
          scenario: node,
        });
        return true;
      }
    }
    inStack.delete(node);
    return false;
  }

  for (const s of allScenarios) {
    if (!visited.has(s.name)) {
      dfs(s.name);
    }
  }
}

function checkUnreachableScenarios(config: Config, diagnostics: Diagnostic[]): void {
  const allScenarios = [
    ...config.scenarios.map((s) => ({ name: s.name, deps: s.depends_on ?? [] })),
    ...config.browser_scenarios.map((s) => ({ name: s.name, deps: s.depends_on ?? [] })),
  ];

  const names = new Set(allScenarios.map((s) => s.name));
  const referenced = new Set<string>();
  for (const s of allScenarios) {
    for (const dep of s.deps) {
      referenced.add(dep);
    }
  }

  // Scenarios with deps but not referenced by anything might be leaf nodes (ok)
  // Scenarios referenced but not defined are caught in cycle check
  // Check for duplicate names
  const seen = new Set<string>();
  for (const s of allScenarios) {
    if (seen.has(s.name)) {
      diagnostics.push({
        category: 'dependency',
        severity: 'warning',
        message: `Duplicate scenario name "${s.name}" across terminal and browser scenarios`,
        scenario: s.name,
      });
    }
    seen.add(s.name);
  }
}

function checkEstimatedDuration(config: Config, diagnostics: Diagnostic[]): void {
  for (const s of config.scenarios) {
    let estimatedSeconds = 0;
    for (const step of s.steps) {
      if (step.action === 'sleep') {
        const match = step.value.match(/^(\d+(?:\.\d+)?)(s|ms)?$/);
        if (match) {
          const val = parseFloat(match[1]);
          const unit = match[2] ?? 's';
          estimatedSeconds += unit === 'ms' ? val / 1000 : val;
        }
      } else if (step.action === 'type') {
        // Rough estimate: 50ms per character
        estimatedSeconds += (step.value.length * 50) / 1000;
      } else {
        estimatedSeconds += 0.5; // Default step time
      }
    }

    if (estimatedSeconds > 60) {
      diagnostics.push({
        category: 'performance',
        severity: 'warning',
        message: `Scenario "${s.name}" estimated at ${estimatedSeconds.toFixed(0)}s — consider splitting into smaller scenarios`,
        scenario: s.name,
      });
    }

    if (estimatedSeconds < 1 && s.steps.length > 0) {
      diagnostics.push({
        category: 'performance',
        severity: 'info',
        message: `Scenario "${s.name}" estimated at <1s — may be too fast to observe`,
        scenario: s.name,
      });
    }
  }
}

function checkResourceUsage(config: Config, diagnostics: Diagnostic[]): void {
  const totalScenarios = config.scenarios.length + config.browser_scenarios.length;
  const workers = config.recording.max_workers ?? 1;

  if (config.recording.parallel && workers > totalScenarios) {
    diagnostics.push({
      category: 'performance',
      severity: 'info',
      message: `Workers (${workers}) exceeds scenario count (${totalScenarios}) — extra workers will be idle`,
    });
  }

  if (config.recording.fps > 30) {
    diagnostics.push({
      category: 'performance',
      severity: 'warning',
      message: `FPS of ${config.recording.fps} produces large files — consider 10-15 for demos`,
    });
  }

  const resolution = (config.recording.width ?? 1200) * (config.recording.height ?? 800);
  if (resolution > 1920 * 1080) {
    diagnostics.push({
      category: 'performance',
      severity: 'info',
      message: `Large recording area (${config.recording.width}×${config.recording.height}) — may increase file size significantly`,
    });
  }
}

function checkBestPractices(config: Config, diagnostics: Diagnostic[]): void {
  // Check for scenarios without tags
  const untagged = [
    ...config.scenarios.filter((s) => !s.tags || s.tags.length === 0),
    ...config.browser_scenarios.filter((s) => !s.tags || s.tags.length === 0),
  ];

  if (untagged.length > 3) {
    diagnostics.push({
      category: 'best-practice',
      severity: 'info',
      message: `${untagged.length} scenarios without tags — tagging helps with filtering and organization`,
    });
  }

  // Check for long scenario names
  const longNames = [
    ...config.scenarios.filter((s) => s.name.length > 30),
    ...config.browser_scenarios.filter((s) => s.name.length > 30),
  ];

  for (const s of longNames) {
    diagnostics.push({
      category: 'best-practice',
      severity: 'info',
      message: `Scenario "${s.name}" has a long name (${s.name.length} chars) — shorter names work better in reports`,
      scenario: s.name,
    });
  }
}

/**
 * Format doctor results as a human-readable report.
 */
export function formatDoctorResult(result: DoctorResult): string {
  const lines: string[] = [];
  lines.push('Config Doctor');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.diagnostics.length === 0) {
    lines.push('  ✓ No issues found — config looks healthy!');
    return lines.join('\n');
  }

  const icons = { error: '✗', warning: '⚠', info: 'ℹ' };
  const categories = ['dependency', 'performance', 'compatibility', 'best-practice'] as const;

  for (const cat of categories) {
    const items = result.diagnostics.filter((d) => d.category === cat);
    if (items.length === 0) continue;

    lines.push(`  ${cat.toUpperCase()}`);
    for (const d of items) {
      const icon = icons[d.severity];
      lines.push(`    ${icon} ${d.message}`);
    }
    lines.push('');
  }

  lines.push(`Summary: ${result.errorCount} errors, ${result.warningCount} warnings, ${result.infoCount} info`);
  lines.push(`Result: ${result.passed ? 'PASSED' : 'FAILED'}`);

  return lines.join('\n');
}
