/**
 * Tag suggestion engine — analyze scenario step patterns
 * and suggest tags based on common action patterns.
 *
 * Helps users organize scenarios with consistent tagging.
 */

import type { Config } from '../config/schema.js';

/** A tag suggestion for a scenario. */
export interface TagSuggestion {
  /** Scenario name. */
  readonly scenario: string;
  /** Existing tags. */
  readonly existingTags: readonly string[];
  /** Suggested new tags. */
  readonly suggestedTags: readonly string[];
  /** Reason for each suggestion. */
  readonly reasons: readonly string[];
}

/** Tag suggestion result. */
export interface TagSuggestionResult {
  /** Per-scenario suggestions. */
  readonly suggestions: readonly TagSuggestion[];
  /** Scenarios already well-tagged (no suggestions). */
  readonly wellTaggedCount: number;
  /** Total scenarios analyzed. */
  readonly totalScenarios: number;
}

/** Step pattern rules for tag inference. */
const PATTERN_RULES: Array<{
  tag: string;
  condition: (steps: readonly { action: string; value: string }[], name: string, desc: string) => boolean;
  reason: string;
}> = [
  {
    tag: 'setup',
    condition: (_, name, desc) =>
      /setup|init|install|bootstrap/i.test(name) || /setup|init|install|bootstrap/i.test(desc),
    reason: 'Name/description suggests setup or initialization',
  },
  {
    tag: 'demo',
    condition: (_, name, desc) =>
      /demo|showcase|walkthrough|tour/i.test(name) || /demo|showcase|walkthrough|tour/i.test(desc),
    reason: 'Name/description suggests a demonstration',
  },
  {
    tag: 'test',
    condition: (steps) =>
      steps.some((s) => s.action === 'type' && /test|spec|check|assert/i.test(s.value)),
    reason: 'Contains test/check-related commands',
  },
  {
    tag: 'api',
    condition: (steps) =>
      steps.some((s) => s.action === 'type' && /curl|http|api|endpoint|fetch/i.test(s.value)),
    reason: 'Contains API-related commands (curl, http, etc.)',
  },
  {
    tag: 'build',
    condition: (steps) =>
      steps.some((s) => s.action === 'type' && /build|compile|bundle|webpack|vite|esbuild/i.test(s.value)),
    reason: 'Contains build-related commands',
  },
  {
    tag: 'deploy',
    condition: (steps) =>
      steps.some((s) => s.action === 'type' && /deploy|publish|release|push/i.test(s.value)),
    reason: 'Contains deployment-related commands',
  },
  {
    tag: 'database',
    condition: (steps) =>
      steps.some((s) => s.action === 'type' && /sql|database|db|migration|seed|prisma|knex/i.test(s.value)),
    reason: 'Contains database-related commands',
  },
  {
    tag: 'auth',
    condition: (steps, _name, desc) =>
      steps.some((s) => s.action === 'type' && /login|auth|token|password|credential/i.test(s.value)) ||
      /login|auth|sign.?in/i.test(desc),
    reason: 'Contains authentication-related steps',
  },
  {
    tag: 'interactive',
    condition: (steps) => {
      const keySteps = steps.filter((s) => s.action === 'key').length;
      return keySteps > 3;
    },
    reason: 'Has many keyboard interaction steps',
  },
  {
    tag: 'long-running',
    condition: (steps) => {
      let totalSleep = 0;
      for (const s of steps) {
        if (s.action === 'sleep') {
          const match = s.value.match(/^(\d+(?:\.\d+)?)(s|ms)?$/);
          if (match) {
            const val = parseFloat(match[1]);
            totalSleep += match[2] === 'ms' ? val / 1000 : val;
          }
        }
      }
      return totalSleep > 30;
    },
    reason: 'Total sleep time exceeds 30 seconds',
  },
];

/**
 * Analyze scenarios and suggest tags based on step patterns.
 */
export function suggestTags(config: Config): TagSuggestionResult {
  const suggestions: TagSuggestion[] = [];
  let wellTaggedCount = 0;

  const allScenarios = [
    ...config.scenarios.map((s) => ({
      name: s.name,
      description: s.description,
      tags: s.tags ?? [],
      steps: s.steps,
    })),
    ...config.browser_scenarios.map((s) => ({
      name: s.name,
      description: s.description,
      tags: s.tags ?? [],
      steps: s.steps,
    })),
  ];

  for (const scenario of allScenarios) {
    const suggestedTags: string[] = [];
    const reasons: string[] = [];

    for (const rule of PATTERN_RULES) {
      // Skip if already tagged with this
      if (scenario.tags.includes(rule.tag)) continue;

      if (rule.condition(scenario.steps, scenario.name, scenario.description)) {
        suggestedTags.push(rule.tag);
        reasons.push(rule.reason);
      }
    }

    if (suggestedTags.length === 0) {
      wellTaggedCount++;
    } else {
      suggestions.push({
        scenario: scenario.name,
        existingTags: scenario.tags,
        suggestedTags,
        reasons,
      });
    }
  }

  return {
    suggestions,
    wellTaggedCount,
    totalScenarios: allScenarios.length,
  };
}

/**
 * Format tag suggestions as a human-readable report.
 */
export function formatTagSuggestions(result: TagSuggestionResult): string {
  const lines: string[] = [];
  lines.push('Tag Suggestions');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalScenarios === 0) {
    lines.push('  No scenarios to analyze.');
    return lines.join('\n');
  }

  if (result.suggestions.length === 0) {
    lines.push('  ✓ All scenarios are well-tagged — no suggestions.');
    lines.push(`  Analyzed: ${result.totalScenarios} scenarios`);
    return lines.join('\n');
  }

  for (const s of result.suggestions) {
    const existing = s.existingTags.length > 0 ? `[${s.existingTags.join(', ')}]` : '(none)';
    lines.push(`  ${s.scenario}`);
    lines.push(`    Current tags: ${existing}`);
    lines.push(`    Suggested: ${s.suggestedTags.map((t) => `+${t}`).join(', ')}`);
    for (let i = 0; i < s.reasons.length; i++) {
      lines.push(`      → ${s.suggestedTags[i]}: ${s.reasons[i]}`);
    }
    lines.push('');
  }

  lines.push(`Summary: ${result.suggestions.length} scenarios with suggestions, ${result.wellTaggedCount} well-tagged`);
  return lines.join('\n');
}
