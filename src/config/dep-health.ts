/**
 * Scenario dependency health checker — validates the dependency graph
 * for issues beyond simple cycles: deep chains, orphaned scenarios,
 * fan-out/fan-in warnings, and missing targets.
 */

import type { DependencyScenario } from './dependencies.js';
import { round2 } from '../analytics/utils.js';

/** Severity of a dependency health issue. */
export type DepHealthSeverity = 'error' | 'warning' | 'info';

/** A single dependency health issue. */
export interface DepHealthIssue {
  /** Issue severity. */
  readonly severity: DepHealthSeverity;
  /** Issue code for programmatic use. */
  readonly code: string;
  /** Human-readable description. */
  readonly message: string;
  /** Affected scenario names. */
  readonly scenarios: readonly string[];
}

/** Dependency health check result. */
export interface DepHealthResult {
  /** All issues found, sorted by severity. */
  readonly issues: readonly DepHealthIssue[];
  /** Whether the graph is healthy (no errors). */
  readonly healthy: boolean;
  /** Total scenarios. */
  readonly totalScenarios: number;
  /** Root scenarios (no dependencies). */
  readonly rootCount: number;
  /** Leaf scenarios (nothing depends on them). */
  readonly leafCount: number;
  /** Maximum depth of the dependency chain. */
  readonly maxDepth: number;
  /** Average fan-out (avg dependencies per scenario). */
  readonly avgFanOut: number;
}

/**
 * Run dependency health checks.
 *
 * @param maxDepthThreshold Depth above which a warning is issued (default: 5).
 * @param maxFanOutThreshold Fan-out above which a warning is issued (default: 5).
 * @param maxFanInThreshold Fan-in above which a warning is issued (default: 10).
 */
export function checkDependencyHealth(
  scenarios: readonly DependencyScenario[],
  maxDepthThreshold = 5,
  maxFanOutThreshold = 5,
  maxFanInThreshold = 10,
): DepHealthResult {
  if (scenarios.length === 0) {
    return {
      issues: [],
      healthy: true,
      totalScenarios: 0,
      rootCount: 0,
      leafCount: 0,
      maxDepth: 0,
      avgFanOut: 0,
    };
  }

  const names = new Set(scenarios.map((s) => s.name));
  const issues: DepHealthIssue[] = [];

  // 1. Missing targets
  for (const s of scenarios) {
    for (const dep of s.depends_on ?? []) {
      if (!names.has(dep)) {
        issues.push({
          severity: 'error',
          code: 'MISSING_TARGET',
          message: `"${s.name}" depends on "${dep}" which does not exist`,
          scenarios: [s.name, dep],
        });
      }
    }
  }

  // 2. Self-dependencies
  for (const s of scenarios) {
    if ((s.depends_on ?? []).includes(s.name)) {
      issues.push({
        severity: 'error',
        code: 'SELF_DEPENDENCY',
        message: `"${s.name}" depends on itself`,
        scenarios: [s.name],
      });
    }
  }

  // 3. Cycle detection (DFS-based)
  const adjList = new Map<string, string[]>();
  for (const s of scenarios) {
    adjList.set(s.name, s.depends_on?.filter((d) => names.has(d)) ?? []);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    for (const dep of adjList.get(node) ?? []) {
      dfs(dep, [...path, node]);
    }
    inStack.delete(node);
  }

  for (const s of scenarios) {
    dfs(s.name, []);
  }

  for (const cycle of cycles) {
    issues.push({
      severity: 'error',
      code: 'CYCLE',
      message: `Circular dependency: ${cycle.join(' → ')} → ${cycle[0]}`,
      scenarios: cycle,
    });
  }

  // 4. Depth analysis (BFS from roots)
  const depthMap = new Map<string, number>();
  const roots: string[] = [];
  const dependedOn = new Set<string>();

  for (const s of scenarios) {
    for (const dep of s.depends_on ?? []) {
      if (names.has(dep)) dependedOn.add(dep);
    }
  }

  for (const s of scenarios) {
    if ((s.depends_on ?? []).length === 0 || (s.depends_on ?? []).every((d) => !names.has(d))) {
      roots.push(s.name);
      depthMap.set(s.name, 0);
    }
  }

  // BFS to compute depth (reverse direction: from dependents, not dependencies)
  const reverseAdj = new Map<string, string[]>();
  for (const s of scenarios) {
    for (const dep of s.depends_on ?? []) {
      if (names.has(dep)) {
        const arr = reverseAdj.get(dep) ?? [];
        arr.push(s.name);
        reverseAdj.set(dep, arr);
      }
    }
  }

  const queue = [...roots];
  while (queue.length > 0) {
    const node = queue.shift()!;
    const depth = depthMap.get(node) ?? 0;
    for (const child of reverseAdj.get(node) ?? []) {
      const currentDepth = depthMap.get(child) ?? -1;
      if (depth + 1 > currentDepth) {
        depthMap.set(child, depth + 1);
        queue.push(child);
      }
    }
  }

  const maxDepth = depthMap.size > 0 ? Math.max(...depthMap.values()) : 0;

  if (maxDepth > maxDepthThreshold) {
    const deepScenarios = [...depthMap.entries()]
      .filter(([, d]) => d > maxDepthThreshold)
      .map(([name]) => name);
    issues.push({
      severity: 'warning',
      code: 'DEEP_CHAIN',
      message: `Dependency chain depth ${maxDepth} exceeds threshold ${maxDepthThreshold}`,
      scenarios: deepScenarios,
    });
  }

  // 5. Fan-out (number of direct dependencies)
  for (const s of scenarios) {
    const fanOut = (s.depends_on ?? []).filter((d) => names.has(d)).length;
    if (fanOut > maxFanOutThreshold) {
      issues.push({
        severity: 'warning',
        code: 'HIGH_FAN_OUT',
        message: `"${s.name}" has ${fanOut} dependencies (threshold: ${maxFanOutThreshold})`,
        scenarios: [s.name],
      });
    }
  }

  // 6. Fan-in (number of dependents)
  const fanInMap = new Map<string, string[]>();
  for (const s of scenarios) {
    for (const dep of s.depends_on ?? []) {
      if (names.has(dep)) {
        const arr = fanInMap.get(dep) ?? [];
        arr.push(s.name);
        fanInMap.set(dep, arr);
      }
    }
  }

  for (const [name, dependents] of fanInMap) {
    if (dependents.length > maxFanInThreshold) {
      issues.push({
        severity: 'warning',
        code: 'HIGH_FAN_IN',
        message: `"${name}" is depended on by ${dependents.length} scenarios (threshold: ${maxFanInThreshold})`,
        scenarios: [name, ...dependents],
      });
    }
  }

  // 7. Orphaned scenarios (not a root, but also not depended on by anything and has no deps)
  const leaves: string[] = [];
  for (const s of scenarios) {
    if (!dependedOn.has(s.name) && (fanInMap.get(s.name) ?? []).length === 0) {
      leaves.push(s.name);
    }
  }

  // 8. Disconnected components
  const components = findComponents(scenarios, names, adjList, reverseAdj);
  if (components > 1) {
    issues.push({
      severity: 'info',
      code: 'DISCONNECTED',
      message: `Dependency graph has ${components} disconnected component(s)`,
      scenarios: [],
    });
  }

  // Sort issues by severity: error > warning > info
  const severityOrder: Record<DepHealthSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Stats
  const totalFanOut = scenarios.reduce(
    (s, sc) => s + (sc.depends_on ?? []).filter((d) => names.has(d)).length,
    0,
  );
  const avgFanOut = round2(totalFanOut / scenarios.length);

  return {
    issues,
    healthy: !issues.some((i) => i.severity === 'error'),
    totalScenarios: scenarios.length,
    rootCount: roots.length,
    leafCount: leaves.length,
    maxDepth,
    avgFanOut,
  };
}

function findComponents(
  scenarios: readonly DependencyScenario[],
  names: Set<string>,
  adjList: Map<string, string[]>,
  reverseAdj: Map<string, string[]>,
): number {
  const visited = new Set<string>();
  let components = 0;

  function bfs(start: string): void {
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const neighbor of [...(adjList.get(node) ?? []), ...(reverseAdj.get(node) ?? [])]) {
        if (!visited.has(neighbor) && names.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  for (const s of scenarios) {
    if (!visited.has(s.name)) {
      bfs(s.name);
      components++;
    }
  }

  return components;
}

/**
 * Format dependency health report.
 */
export function formatDepHealth(result: DepHealthResult): string {
  const lines: string[] = [];
  const severityIcons: Record<DepHealthSeverity, string> = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  lines.push('Dependency Health Check');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalScenarios === 0) {
    lines.push('  No scenarios to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Status:     ${result.healthy ? '✅ healthy' : '❌ unhealthy'}`);
  lines.push(`  Scenarios:  ${result.totalScenarios} (${result.rootCount} roots, ${result.leafCount} leaves)`);
  lines.push(`  Max depth:  ${result.maxDepth}`);
  lines.push(`  Avg fan-out: ${result.avgFanOut}`);
  lines.push('');

  if (result.issues.length === 0) {
    lines.push('  No issues found.');
  } else {
    lines.push(`  Issues (${result.issues.length}):`);
    for (const issue of result.issues) {
      lines.push(`    ${severityIcons[issue.severity]} [${issue.code}] ${issue.message}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
