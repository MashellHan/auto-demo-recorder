/** Scenario with optional dependency declarations. */
export interface DependencyScenario {
  name: string;
  /** Names of scenarios that must be recorded before this one. */
  depends_on?: string[];
}

/**
 * Topological sort of scenarios based on their dependencies.
 * Returns scenarios in an order where dependencies come before dependents.
 * Uses Kahn's algorithm for a deterministic stable sort.
 */
export function buildDependencyOrder<T extends DependencyScenario>(scenarios: T[]): T[] {
  if (scenarios.length === 0) return [];

  const nameMap = new Map<string, T>();
  for (const s of scenarios) {
    nameMap.set(s.name, s);
  }

  // Build adjacency list and in-degree map
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const s of scenarios) {
    if (!inDegree.has(s.name)) inDegree.set(s.name, 0);
    if (!dependents.has(s.name)) dependents.set(s.name, []);

    for (const dep of s.depends_on ?? []) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(s.name);
      inDegree.set(s.name, (inDegree.get(s.name) ?? 0) + 1);
      if (!inDegree.has(dep)) inDegree.set(dep, 0);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  // Sort the initial queue for deterministic ordering
  queue.sort();

  const result: T[] = [];
  while (queue.length > 0) {
    const name = queue.shift()!;
    const scenario = nameMap.get(name);
    if (scenario) {
      result.push(scenario);
    }

    for (const dependent of dependents.get(name) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        // Insert sorted for deterministic ordering
        const insertIdx = queue.findIndex((q) => q > dependent);
        if (insertIdx === -1) {
          queue.push(dependent);
        } else {
          queue.splice(insertIdx, 0, dependent);
        }
      }
    }
  }

  return result;
}

/**
 * Validate scenario dependencies.
 * Returns an array of error messages (empty if valid).
 */
export function validateDependencies(scenarios: DependencyScenario[]): string[] {
  if (scenarios.length === 0) return [];

  const errors: string[] = [];
  const names = new Set(scenarios.map((s) => s.name));

  // Check for missing dependencies
  for (const s of scenarios) {
    for (const dep of s.depends_on ?? []) {
      if (!names.has(dep)) {
        errors.push(`Scenario "${s.name}" depends on "${dep}" which does not exist`);
      }
      if (dep === s.name) {
        errors.push(`Scenario "${s.name}" depends on itself (circular)`);
      }
    }
  }

  // Check for cycles using topological sort
  const ordered = buildDependencyOrder(scenarios);
  if (ordered.length < scenarios.length) {
    const orderedNames = new Set(ordered.map((s) => s.name));
    const cyclicNames = scenarios
      .filter((s) => !orderedNames.has(s.name))
      .map((s) => s.name);
    errors.push(`Circular dependency detected involving: ${cyclicNames.join(', ')}`);
  }

  return errors;
}

/** Edge in the dependency graph. */
export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
}

/** Dependency graph visualization data. */
export interface DependencyGraph {
  /** All scenario names (nodes). */
  readonly nodes: readonly string[];
  /** Dependency edges (from depends on to). */
  readonly edges: readonly DependencyEdge[];
  /** Root nodes (no dependencies). */
  readonly roots: readonly string[];
  /** Leaf nodes (no dependents). */
  readonly leaves: readonly string[];
  /** Maximum depth of the dependency tree. */
  readonly maxDepth: number;
}

/**
 * Build a dependency graph from scenarios.
 */
export function buildDependencyGraph(scenarios: DependencyScenario[]): DependencyGraph {
  const nodes = scenarios.map((s) => s.name);
  const edges: DependencyEdge[] = [];
  const hasDeps = new Set<string>();
  const isDependedOn = new Set<string>();

  for (const s of scenarios) {
    for (const dep of s.depends_on ?? []) {
      edges.push({ from: s.name, to: dep });
      hasDeps.add(s.name);
      isDependedOn.add(dep);
    }
  }

  const roots = nodes.filter((n) => !hasDeps.has(n));
  const leaves = nodes.filter((n) => !isDependedOn.has(n));

  // Calculate max depth using BFS from roots
  const depMap = new Map<string, string[]>();
  for (const s of scenarios) {
    depMap.set(s.name, s.depends_on ?? []);
  }

  let maxDepth = 0;
  const depths = new Map<string, number>();

  for (const root of roots) {
    depths.set(root, 0);
  }

  // Process in topological order
  const ordered = buildDependencyOrder(scenarios);
  for (const s of ordered) {
    const deps = depMap.get(s.name) ?? [];
    if (deps.length === 0) {
      depths.set(s.name, 0);
    } else {
      const depDepths = deps.map((d) => depths.get(d) ?? 0);
      const depth = Math.max(...depDepths) + 1;
      depths.set(s.name, depth);
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return { nodes, edges, roots, leaves, maxDepth };
}

/**
 * Format the dependency graph as ASCII art.
 *
 * Example output:
 * ```
 * Dependency Graph
 * ════════════════
 *   setup
 *   ├── build → setup
 *   │   └── test → build
 *   └── lint → setup
 *
 *   deploy → build, lint
 *
 * Roots: setup (1)
 * Leaves: test, deploy (2)
 * Depth: 2
 * ```
 */
export function formatDependencyGraph(scenarios: DependencyScenario[]): string {
  if (scenarios.length === 0) {
    return 'No scenarios defined.';
  }

  const graph = buildDependencyGraph(scenarios);
  const lines: string[] = [];
  lines.push('Dependency Graph');
  lines.push('═'.repeat(50));
  lines.push('');

  if (graph.edges.length === 0) {
    lines.push('  No dependencies — all scenarios are independent.');
    lines.push('');
    for (const node of graph.nodes) {
      lines.push(`  ○ ${node}`);
    }
  } else {
    // Build reverse map: who depends on this scenario
    const dependentsOf = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (!dependentsOf.has(edge.to)) dependentsOf.set(edge.to, []);
      dependentsOf.get(edge.to)!.push(edge.from);
    }

    // Build deps map: what does this scenario depend on
    const depsOf = new Map<string, string[]>();
    for (const s of scenarios) {
      depsOf.set(s.name, s.depends_on ?? []);
    }

    // Print each scenario with its dependencies
    for (const node of graph.nodes) {
      const deps = depsOf.get(node) ?? [];
      if (deps.length === 0) {
        lines.push(`  ○ ${node} (root)`);
      } else {
        lines.push(`  ● ${node} → ${deps.join(', ')}`);
      }
    }
  }

  lines.push('');
  lines.push(`Roots: ${graph.roots.join(', ')} (${graph.roots.length})`);
  lines.push(`Leaves: ${graph.leaves.join(', ')} (${graph.leaves.length})`);
  lines.push(`Depth: ${graph.maxDepth}`);
  lines.push(`Edges: ${graph.edges.length}`);

  return lines.join('\n');
}
