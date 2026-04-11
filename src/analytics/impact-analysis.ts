/**
 * Dependency impact analysis — when a scenario fails, show which
 * downstream dependent scenarios are affected (blast radius).
 */

/** Minimal scenario shape for impact analysis. */
export interface ImpactScenario {
  readonly name: string;
  readonly depends_on?: readonly string[];
}

/** Impact result for a single failed scenario. */
export interface ScenarioImpact {
  /** The failing scenario. */
  readonly scenario: string;
  /** Direct dependents (scenarios that depend on this one). */
  readonly directDependents: readonly string[];
  /** All transitively affected scenarios. */
  readonly allAffected: readonly string[];
  /** Maximum depth of the impact chain. */
  readonly impactDepth: number;
  /** Impact chain layers (breadth-first from the source). */
  readonly layers: readonly ImpactLayer[];
}

/** A layer of affected scenarios at a given depth. */
export interface ImpactLayer {
  /** Depth from the source scenario (1 = direct dependents). */
  readonly depth: number;
  /** Scenarios at this depth. */
  readonly scenarios: readonly string[];
}

/** Full impact analysis result. */
export interface ImpactAnalysis {
  /** Per-scenario impact results. */
  readonly impacts: readonly ScenarioImpact[];
  /** Scenarios with the largest blast radius. */
  readonly highestImpact: ScenarioImpact | null;
  /** Total scenarios analyzed. */
  readonly totalScenarios: number;
  /** Scenarios with no dependents (leaf nodes). */
  readonly leafScenarios: readonly string[];
  /** Scenarios with no dependencies (root nodes). */
  readonly rootScenarios: readonly string[];
}

/**
 * Analyze the impact of each scenario failing.
 */
export function analyzeImpact(scenarios: readonly ImpactScenario[]): ImpactAnalysis {
  if (scenarios.length === 0) {
    return {
      impacts: [],
      highestImpact: null,
      totalScenarios: 0,
      leafScenarios: [],
      rootScenarios: [],
    };
  }

  // Build reverse dependency map: scenario -> list of scenarios that depend on it
  const dependentsMap = new Map<string, string[]>();
  const nameSet = new Set(scenarios.map((s) => s.name));

  for (const s of scenarios) {
    if (!dependentsMap.has(s.name)) {
      dependentsMap.set(s.name, []);
    }
    for (const dep of s.depends_on ?? []) {
      if (nameSet.has(dep)) {
        const list = dependentsMap.get(dep) ?? [];
        list.push(s.name);
        dependentsMap.set(dep, list);
      }
    }
  }

  const impacts: ScenarioImpact[] = [];

  for (const s of scenarios) {
    const impact = computeImpact(s.name, dependentsMap);
    impacts.push(impact);
  }

  // Sort by blast radius descending
  impacts.sort((a, b) => b.allAffected.length - a.allAffected.length);

  const highestImpact = impacts.length > 0 && impacts[0].allAffected.length > 0
    ? impacts[0]
    : null;

  const leafScenarios = impacts
    .filter((i) => i.directDependents.length === 0)
    .map((i) => i.scenario);

  const rootScenarios = scenarios
    .filter((s) => !s.depends_on || s.depends_on.length === 0)
    .map((s) => s.name);

  return {
    impacts,
    highestImpact,
    totalScenarios: scenarios.length,
    leafScenarios,
    rootScenarios,
  };
}

function computeImpact(
  name: string,
  dependentsMap: Map<string, string[]>,
): ScenarioImpact {
  const directDependents = dependentsMap.get(name) ?? [];
  const allAffected: string[] = [];
  const visited = new Set<string>();
  const layers: ImpactLayer[] = [];

  // BFS from the source
  let queue = [...directDependents];
  let depth = 1;

  while (queue.length > 0) {
    const layerScenarios: string[] = [];
    const nextQueue: string[] = [];

    for (const s of queue) {
      if (!visited.has(s)) {
        visited.add(s);
        allAffected.push(s);
        layerScenarios.push(s);
        const deps = dependentsMap.get(s) ?? [];
        nextQueue.push(...deps);
      }
    }

    if (layerScenarios.length > 0) {
      layers.push({ depth, scenarios: layerScenarios });
    }
    queue = nextQueue;
    depth++;
  }

  return {
    scenario: name,
    directDependents,
    allAffected,
    impactDepth: layers.length,
    layers,
  };
}

/**
 * Analyze impact for specific failing scenarios only.
 */
export function analyzeFailureImpact(
  scenarios: readonly ImpactScenario[],
  failingNames: readonly string[],
): ImpactAnalysis {
  const full = analyzeImpact(scenarios);
  const failSet = new Set(failingNames);
  const filtered = full.impacts.filter((i) => failSet.has(i.scenario));

  const highestImpact = filtered.length > 0 && filtered[0].allAffected.length > 0
    ? filtered[0]
    : null;

  return {
    ...full,
    impacts: filtered,
    highestImpact,
  };
}

/**
 * Format impact analysis report.
 */
export function formatImpactAnalysis(result: ImpactAnalysis): string {
  const lines: string[] = [];
  lines.push('Dependency Impact Analysis');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalScenarios === 0) {
    lines.push('  No scenarios to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Total scenarios: ${result.totalScenarios}`);
  lines.push(`  Root scenarios:  ${result.rootScenarios.length} (no dependencies)`);
  lines.push(`  Leaf scenarios:  ${result.leafScenarios.length} (no dependents)`);

  if (result.highestImpact) {
    lines.push('');
    lines.push(`  ⚠ Highest impact: "${result.highestImpact.scenario}" → affects ${result.highestImpact.allAffected.length} scenario(s)`);
  }

  lines.push('');

  const impactsWithDeps = result.impacts.filter((i) => i.allAffected.length > 0);

  if (impactsWithDeps.length === 0) {
    lines.push('  No scenarios have downstream dependents.');
  } else {
    lines.push('  Impact per scenario:');
    for (const i of impactsWithDeps) {
      lines.push(`    "${i.scenario}" (depth ${i.impactDepth}, ${i.allAffected.length} affected):`);
      for (const layer of i.layers) {
        const names = layer.scenarios.join(', ');
        lines.push(`      L${layer.depth}: ${names}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}
