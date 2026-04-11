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
