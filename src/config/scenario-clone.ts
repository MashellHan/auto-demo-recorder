/**
 * Scenario cloning utility — create variants of existing scenarios
 * with selective overrides.
 *
 * Useful for:
 * - Creating test variants (e.g., same steps, different theme)
 * - Generating regression scenarios from existing ones
 * - Building scenario families with shared setup
 */

import type { Scenario, BrowserScenario, Step } from './schema.js';

/** Options for cloning a terminal scenario. */
export interface CloneOptions {
  /** New scenario name (required). */
  readonly name: string;
  /** New description (optional, defaults to "Clone of {original}"). */
  readonly description?: string;
  /** Override tags. */
  readonly tags?: readonly string[];
  /** Additional steps to append. */
  readonly appendSteps?: readonly Step[];
  /** Additional steps to prepend. */
  readonly prependSteps?: readonly Step[];
  /** Override setup commands. */
  readonly setup?: readonly string[];
  /** Override depends_on. */
  readonly dependsOn?: readonly string[];
}

/**
 * Clone a terminal scenario with optional overrides.
 */
export function cloneScenario(source: Scenario, options: CloneOptions): Scenario {
  const steps = [
    ...(options.prependSteps ?? []),
    ...source.steps,
    ...(options.appendSteps ?? []),
  ];

  return {
    name: options.name,
    description: options.description ?? `Clone of ${source.name}`,
    setup: options.setup ? [...options.setup] : [...source.setup],
    steps,
    tags: options.tags ? [...options.tags] : [...(source.tags ?? [])],
    depends_on: options.dependsOn ? [...options.dependsOn] : [...(source.depends_on ?? [])],
    hooks: source.hooks ? { ...source.hooks } : undefined,
  };
}

/**
 * Clone a browser scenario with optional overrides.
 */
export function cloneBrowserScenario(
  source: BrowserScenario,
  options: CloneOptions & { url?: string },
): BrowserScenario {
  const steps = [
    ...(options.prependSteps as BrowserScenario['steps'] ?? []),
    ...source.steps,
    ...(options.appendSteps as BrowserScenario['steps'] ?? []),
  ];

  return {
    name: options.name,
    description: options.description ?? `Clone of ${source.name}`,
    url: options.url ?? source.url,
    setup: options.setup ? [...options.setup] : [...source.setup],
    steps,
    tags: options.tags ? [...options.tags] : [...(source.tags ?? [])],
    depends_on: options.dependsOn ? [...options.dependsOn] : [...(source.depends_on ?? [])],
    hooks: source.hooks ? { ...source.hooks } : undefined,
  };
}

/** Batch clone result. */
export interface BatchCloneResult {
  /** Successfully cloned scenarios. */
  readonly cloned: readonly Scenario[];
  /** Names generated. */
  readonly names: readonly string[];
}

/**
 * Create multiple variants of a scenario with a naming pattern.
 *
 * @param source - Base scenario to clone
 * @param variants - Array of variant configs with partial overrides
 * @param namePrefix - Prefix for variant names (e.g., "regression")
 */
export function batchClone(
  source: Scenario,
  variants: readonly Partial<CloneOptions>[],
  namePrefix: string = source.name,
): BatchCloneResult {
  const cloned: Scenario[] = [];
  const names: string[] = [];

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const name = variant.name ?? `${namePrefix}-variant-${i + 1}`;
    const scenario = cloneScenario(source, {
      ...variant,
      name,
    });
    cloned.push(scenario);
    names.push(name);
  }

  return { cloned, names };
}

/**
 * Format a clone operation summary.
 */
export function formatCloneSummary(sourceName: string, cloned: readonly { name: string }[]): string {
  const lines: string[] = [];
  lines.push(`Cloned from "${sourceName}":`);
  for (const c of cloned) {
    lines.push(`  → ${c.name}`);
  }
  lines.push(`Total: ${cloned.length} variant(s) created`);
  return lines.join('\n');
}
