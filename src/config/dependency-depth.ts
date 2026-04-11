/**
 * Dependency depth analysis — analyze scenario dependency chains
 * to identify depth, critical paths, and unreachable scenarios.
 */

import type { DependencyScenario } from './dependencies.js';

/** Depth analysis for a single scenario. */
export interface ScenarioDepthInfo {
  /** Scenario name. */
  readonly name: string;
  /** Depth in the dependency tree (0 = no dependencies). */
  readonly depth: number;
  /** Direct dependencies. */
  readonly directDeps: readonly string[];
  /** All transitive dependencies. */
  readonly allDeps: readonly string[];
  /** Direct dependents (scenarios that depend on this one). */
  readonly directDependents: readonly string[];
  /** Whether this scenario is reachable (all deps exist). */
  readonly reachable: boolean;
  /** Missing dependencies (deps that don't exist). */
  readonly missingDeps: readonly string[];
}

/** Dependency depth analysis result. */
export interface DepthAnalysis {
  /** Per-scenario analysis. */
  readonly scenarios: readonly ScenarioDepthInfo[];
  /** Maximum depth in the dependency tree. */
  readonly maxDepth: number;
  /** Scenarios at the critical path (deepest chain). */
  readonly criticalPath: readonly string[];
  /** Root scenarios (no dependencies). */
  readonly roots: readonly string[];
  /** Leaf scenarios (nothing depends on them). */
  readonly leaves: readonly string[];
  /** Unreachable scenarios (missing dependencies). */
  readonly unreachable: readonly string[];
}

/**
 * Analyze dependency depth for a set of scenarios.
 */
export function analyzeDependencyDepth(scenarios: readonly DependencyScenario[]): DepthAnalysis {
  const nameSet = new Set(scenarios.map((s) => s.name));
  const depsMap = new Map<string, readonly string[]>();
  const dependentsMap = new Map<string, string[]>();

  for (const s of scenarios) {
    const deps = s.depends_on ?? [];
    depsMap.set(s.name, deps);
    if (!dependentsMap.has(s.name)) dependentsMap.set(s.name, []);
    for (const dep of deps) {
      const list = dependentsMap.get(dep) ?? [];
      list.push(s.name);
      dependentsMap.set(dep, list);
    }
  }

  // Compute all transitive deps and depth for each scenario
  const depthCache = new Map<string, number>();
  const allDepsCache = new Map<string, Set<string>>();

  function computeDepth(name: string, visited: Set<string>): number {
    if (depthCache.has(name)) return depthCache.get(name)!;
    if (visited.has(name)) return 0; // Circular — stop
    visited.add(name);

    const deps = depsMap.get(name) ?? [];
    if (deps.length === 0) {
      depthCache.set(name, 0);
      allDepsCache.set(name, new Set());
      return 0;
    }

    let maxChildDepth = 0;
    const allDeps = new Set<string>();
    for (const dep of deps) {
      allDeps.add(dep);
      if (nameSet.has(dep)) {
        const childDepth = computeDepth(dep, visited);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
        const childAllDeps = allDepsCache.get(dep) ?? new Set();
        for (const d of childAllDeps) allDeps.add(d);
      }
    }

    const depth = maxChildDepth + 1;
    depthCache.set(name, depth);
    allDepsCache.set(name, allDeps);
    return depth;
  }

  for (const s of scenarios) {
    computeDepth(s.name, new Set());
  }

  const infos: ScenarioDepthInfo[] = scenarios.map((s) => {
    const directDeps = s.depends_on ?? [];
    const missingDeps = directDeps.filter((d) => !nameSet.has(d));
    const allDeps = [...(allDepsCache.get(s.name) ?? [])].sort();

    return {
      name: s.name,
      depth: depthCache.get(s.name) ?? 0,
      directDeps,
      allDeps,
      directDependents: (dependentsMap.get(s.name) ?? []).sort(),
      reachable: missingDeps.length === 0,
      missingDeps,
    };
  });

  infos.sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name));

  const maxDepth = infos.length > 0 ? infos[0].depth : 0;

  // Find the critical path: the deepest chain
  const criticalPath = buildCriticalPath(infos, depsMap);

  const roots = infos.filter((i) => i.directDeps.length === 0).map((i) => i.name).sort();
  const leaves = infos.filter((i) => i.directDependents.length === 0).map((i) => i.name).sort();
  const unreachable = infos.filter((i) => !i.reachable).map((i) => i.name).sort();

  return {
    scenarios: infos,
    maxDepth,
    criticalPath,
    roots,
    leaves,
    unreachable,
  };
}

function buildCriticalPath(
  infos: readonly ScenarioDepthInfo[],
  depsMap: Map<string, readonly string[]>,
): readonly string[] {
  if (infos.length === 0) return [];

  // Start from the deepest scenario
  const deepest = infos[0];
  const path: string[] = [deepest.name];

  let current = deepest.name;
  while (true) {
    const deps = depsMap.get(current) ?? [];
    if (deps.length === 0) break;

    // Follow the deepest dependency
    const depInfos = infos.filter((i) => deps.includes(i.name));
    if (depInfos.length === 0) break;

    const deepestDep = depInfos.reduce((best, d) => d.depth > best.depth ? d : best);
    path.push(deepestDep.name);
    current = deepestDep.name;
  }

  return path.reverse();
}

/**
 * Format dependency depth analysis report.
 */
export function formatDepthAnalysis(result: DepthAnalysis): string {
  const lines: string[] = [];
  lines.push('Dependency Depth Analysis');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.scenarios.length === 0) {
    lines.push('  No scenarios to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Max depth:     ${result.maxDepth}`);
  lines.push(`  Root nodes:    ${result.roots.length} (${result.roots.join(', ')})`);
  lines.push(`  Leaf nodes:    ${result.leaves.length} (${result.leaves.join(', ')})`);

  if (result.unreachable.length > 0) {
    lines.push(`  ⚠ Unreachable: ${result.unreachable.join(', ')}`);
  }

  if (result.criticalPath.length > 1) {
    lines.push(`  Critical path: ${result.criticalPath.join(' → ')}`);
  }

  lines.push('');
  lines.push(`  ${'Scenario'.padEnd(22)} ${'Depth'.padStart(6)} ${'Deps'.padStart(6)} ${'Dependents'.padStart(12)}`);
  lines.push('  ' + '─'.repeat(48));

  for (const s of result.scenarios) {
    const marker = !s.reachable ? ' ⚠' : '';
    lines.push(`  ${(s.name + marker).padEnd(22)} ${s.depth.toString().padStart(6)} ${s.directDeps.length.toString().padStart(6)} ${s.directDependents.length.toString().padStart(12)}`);
  }

  lines.push('');
  return lines.join('\n');
}
