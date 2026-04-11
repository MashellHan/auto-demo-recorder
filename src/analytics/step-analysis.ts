/**
 * Step analytics — analyze the distribution and patterns of step
 * types across all scenarios.
 *
 * Useful for understanding recording complexity, identifying
 * common patterns, and optimizing scenario design.
 */

import type { Config } from '../config/schema.js';

/** Stats for a single step action type. */
export interface StepTypeStats {
  /** Action type (e.g., "type", "key", "sleep"). */
  readonly action: string;
  /** Total count across all scenarios. */
  readonly count: number;
  /** Percentage of total steps. */
  readonly percentage: number;
  /** Scenarios using this action. */
  readonly scenarioCount: number;
}

/** Per-scenario complexity metrics. */
export interface ScenarioComplexity {
  /** Scenario name. */
  readonly name: string;
  /** Backend type. */
  readonly backend: 'vhs' | 'browser';
  /** Total step count. */
  readonly stepCount: number;
  /** Unique action types used. */
  readonly uniqueActions: number;
  /** Has setup commands. */
  readonly hasSetup: boolean;
  /** Has lifecycle hooks. */
  readonly hasHooks: boolean;
  /** Has dependencies. */
  readonly hasDependencies: boolean;
  /** Complexity score (0-10). */
  readonly complexityScore: number;
}

/** Complete step analysis result. */
export interface StepAnalysis {
  /** Stats per action type. */
  readonly typeStats: readonly StepTypeStats[];
  /** Per-scenario complexity metrics. */
  readonly scenarios: readonly ScenarioComplexity[];
  /** Total step count across all scenarios. */
  readonly totalSteps: number;
  /** Total scenario count. */
  readonly totalScenarios: number;
  /** Average steps per scenario. */
  readonly avgStepsPerScenario: number;
  /** Most complex scenario. */
  readonly mostComplex: ScenarioComplexity | null;
}

/**
 * Analyze step distribution and scenario complexity.
 */
export function analyzeSteps(config: Config): StepAnalysis {
  const actionCounts = new Map<string, { count: number; scenarios: Set<string> }>();
  let totalSteps = 0;

  const scenarios: ScenarioComplexity[] = [];

  // Process terminal scenarios
  for (const s of config.scenarios) {
    const actions = new Set<string>();
    for (const step of s.steps) {
      actions.add(step.action);
      totalSteps++;
      if (!actionCounts.has(step.action)) {
        actionCounts.set(step.action, { count: 0, scenarios: new Set() });
      }
      const entry = actionCounts.get(step.action)!;
      entry.count++;
      entry.scenarios.add(s.name);
    }

    scenarios.push({
      name: s.name,
      backend: 'vhs',
      stepCount: s.steps.length,
      uniqueActions: actions.size,
      hasSetup: (s.setup?.length ?? 0) > 0,
      hasHooks: !!s.hooks?.before || !!s.hooks?.after,
      hasDependencies: (s.depends_on?.length ?? 0) > 0,
      complexityScore: computeComplexity(s.steps.length, actions.size, s.setup, s.hooks, s.depends_on),
    });
  }

  // Process browser scenarios
  for (const s of config.browser_scenarios) {
    const actions = new Set<string>();
    for (const step of s.steps) {
      actions.add(step.action);
      totalSteps++;
      if (!actionCounts.has(step.action)) {
        actionCounts.set(step.action, { count: 0, scenarios: new Set() });
      }
      const entry = actionCounts.get(step.action)!;
      entry.count++;
      entry.scenarios.add(s.name);
    }

    scenarios.push({
      name: s.name,
      backend: 'browser',
      stepCount: s.steps.length,
      uniqueActions: actions.size,
      hasSetup: (s.setup?.length ?? 0) > 0,
      hasHooks: !!s.hooks?.before || !!s.hooks?.after,
      hasDependencies: (s.depends_on?.length ?? 0) > 0,
      complexityScore: computeComplexity(s.steps.length, actions.size, s.setup, s.hooks, s.depends_on),
    });
  }

  // Build type stats sorted by count descending
  const typeStats: StepTypeStats[] = Array.from(actionCounts.entries())
    .map(([action, data]) => ({
      action,
      count: data.count,
      percentage: totalSteps > 0 ? Math.round((data.count / totalSteps) * 100) : 0,
      scenarioCount: data.scenarios.size,
    }))
    .sort((a, b) => b.count - a.count);

  const totalScenarios = scenarios.length;
  const avgStepsPerScenario = totalScenarios > 0 ? Math.round(totalSteps / totalScenarios) : 0;

  let mostComplex: ScenarioComplexity | null = null;
  for (const s of scenarios) {
    if (!mostComplex || s.complexityScore > mostComplex.complexityScore) {
      mostComplex = s;
    }
  }

  return {
    typeStats,
    scenarios,
    totalSteps,
    totalScenarios,
    avgStepsPerScenario,
    mostComplex,
  };
}

function computeComplexity(
  stepCount: number,
  uniqueActions: number,
  setup?: readonly string[],
  hooks?: { before?: string; after?: string },
  dependsOn?: readonly string[],
): number {
  let score = 0;
  // Steps contribute 0-4 points
  score += Math.min(4, Math.floor(stepCount / 3));
  // Unique actions contribute 0-2 points
  score += Math.min(2, uniqueActions);
  // Setup adds 1 point
  if (setup && setup.length > 0) score += 1;
  // Hooks add 1 point
  if (hooks?.before || hooks?.after) score += 1;
  // Dependencies add 1-2 points
  if (dependsOn && dependsOn.length > 0) score += Math.min(2, dependsOn.length);

  return Math.min(10, score);
}

/**
 * Format step analysis as a human-readable report.
 */
export function formatStepAnalysis(result: StepAnalysis): string {
  if (result.totalScenarios === 0) {
    return 'No scenarios to analyze.';
  }

  const lines: string[] = [];
  lines.push('Step Analysis');
  lines.push('═'.repeat(60));
  lines.push('');

  // Step type distribution
  lines.push('  Step Type Distribution:');
  for (const stat of result.typeStats) {
    const bar = '█'.repeat(Math.max(1, Math.round(stat.percentage / 5)));
    lines.push(`    ${stat.action.padEnd(12)} ${bar} ${stat.count} (${stat.percentage}%) in ${stat.scenarioCount} scenario(s)`);
  }
  lines.push('');

  // Scenario complexity
  lines.push('  Scenario Complexity:');
  const sorted = [...result.scenarios].sort((a, b) => b.complexityScore - a.complexityScore);
  for (const s of sorted) {
    const features = [
      s.hasSetup ? 'setup' : null,
      s.hasHooks ? 'hooks' : null,
      s.hasDependencies ? 'deps' : null,
    ].filter(Boolean);
    const featureStr = features.length > 0 ? ` [${features.join(', ')}]` : '';
    lines.push(`    ${s.name.padEnd(20)} ${s.stepCount} steps, ${s.uniqueActions} types, score=${s.complexityScore}/10${featureStr}`);
  }
  lines.push('');

  // Summary
  lines.push(`Total: ${result.totalSteps} steps across ${result.totalScenarios} scenarios`);
  lines.push(`Average: ${result.avgStepsPerScenario} steps/scenario`);
  if (result.mostComplex) {
    lines.push(`Most complex: ${result.mostComplex.name} (score ${result.mostComplex.complexityScore}/10)`);
  }

  return lines.join('\n');
}
