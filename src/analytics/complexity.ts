/**
 * Scenario complexity scorer — evaluate scenario complexity based on
 * step count, step diversity, dependency depth, and hooks.
 *
 * Helps identify scenarios that may benefit from refactoring or splitting.
 */

/** Complexity score for a single scenario. */
export interface ComplexityScore {
  /** Scenario name. */
  readonly scenario: string;
  /** Overall complexity score (0-100). */
  readonly score: number;
  /** Complexity grade. */
  readonly grade: 'simple' | 'moderate' | 'complex' | 'very-complex';
  /** Individual factor scores. */
  readonly factors: {
    /** Step count factor (0-30). */
    readonly stepCount: number;
    /** Step type diversity factor (0-20). */
    readonly stepDiversity: number;
    /** Dependency factor (0-20). */
    readonly dependencies: number;
    /** Hook/lifecycle factor (0-15). */
    readonly hooks: number;
    /** Tag count factor (0-15). */
    readonly tags: number;
  };
  /** Refactoring recommendation. */
  readonly recommendation: string;
}

/** Complexity analysis result. */
export interface ComplexityResult {
  /** Per-scenario scores. */
  readonly scores: readonly ComplexityScore[];
  /** Average complexity score. */
  readonly averageScore: number;
  /** Distribution by grade. */
  readonly distribution: Record<ComplexityScore['grade'], number>;
}

/** Minimal scenario shape for complexity analysis. */
export interface ComplexityScenario {
  readonly name: string;
  readonly steps: readonly { type?: string; action?: string }[];
  readonly depends_on?: readonly string[];
  readonly tags?: readonly string[];
  readonly hooks?: { before?: unknown; after?: unknown };
  readonly description?: string;
}

/**
 * Score scenario complexity.
 */
export function scoreComplexity(scenarios: readonly ComplexityScenario[]): ComplexityResult {
  const scores: ComplexityScore[] = scenarios.map((s) => {
    const stepCountScore = Math.min(30, Math.round((s.steps.length / 20) * 30));
    const uniqueTypes = new Set(s.steps.map((st) => st.type ?? st.action ?? 'unknown'));
    const stepDiversityScore = Math.min(20, uniqueTypes.size * 4);
    const depCount = s.depends_on?.length ?? 0;
    const dependencyScore = Math.min(20, depCount * 7);
    const hasHooks = s.hooks?.before || s.hooks?.after;
    const hookScore = hasHooks ? 15 : 0;
    const tagCount = s.tags?.length ?? 0;
    const tagScore = Math.min(15, tagCount * 3);

    const totalScore = stepCountScore + stepDiversityScore + dependencyScore + hookScore + tagScore;
    const clampedScore = Math.min(100, totalScore);

    const grade = classifyGrade(clampedScore);
    const recommendation = generateRecommendation(s, clampedScore, s.steps.length, depCount);

    return {
      scenario: s.name,
      score: clampedScore,
      grade,
      factors: {
        stepCount: stepCountScore,
        stepDiversity: stepDiversityScore,
        dependencies: dependencyScore,
        hooks: hookScore,
        tags: tagScore,
      },
      recommendation,
    };
  });

  scores.sort((a, b) => b.score - a.score);

  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((s, c) => s + c.score, 0) / scores.length)
    : 0;

  const distribution: Record<ComplexityScore['grade'], number> = {
    'simple': 0, 'moderate': 0, 'complex': 0, 'very-complex': 0,
  };
  for (const s of scores) {
    distribution[s.grade]++;
  }

  return { scores, averageScore, distribution };
}

function classifyGrade(score: number): ComplexityScore['grade'] {
  if (score <= 25) return 'simple';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'complex';
  return 'very-complex';
}

function generateRecommendation(
  scenario: ComplexityScenario,
  score: number,
  stepCount: number,
  depCount: number,
): string {
  if (score <= 25) return 'Good complexity level';
  const tips: string[] = [];
  if (stepCount > 15) tips.push(`split ${stepCount} steps into sub-scenarios`);
  if (depCount > 2) tips.push(`reduce ${depCount} dependencies`);
  if (score > 75) tips.push('consider refactoring for maintainability');
  return tips.length > 0 ? tips.join('; ') : 'Monitor complexity';
}

/**
 * Format complexity analysis report.
 */
export function formatComplexity(result: ComplexityResult): string {
  const lines: string[] = [];
  lines.push('Scenario Complexity Report');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.scores.length === 0) {
    lines.push('  No scenarios to analyze.');
    return lines.join('\n');
  }

  lines.push(`  Average complexity: ${result.averageScore}/100`);
  const distParts = Object.entries(result.distribution)
    .filter(([, count]) => count > 0)
    .map(([grade, count]) => `${grade}: ${count}`);
  lines.push(`  Distribution: ${distParts.join(', ')}`);
  lines.push('');

  const gradeIcons = { 'simple': '🟢', 'moderate': '🟡', 'complex': '🟠', 'very-complex': '🔴' };

  lines.push(`  ${'Scenario'.padEnd(22)} ${'Score'.padStart(6)} ${'Grade'.padStart(14)} ${'Recommendation'}`);
  lines.push('  ' + '─'.repeat(70));

  for (const s of result.scores) {
    const icon = gradeIcons[s.grade];
    lines.push(`  ${s.scenario.padEnd(22)} ${s.score.toString().padStart(6)} ${(icon + ' ' + s.grade).padStart(14)}   ${s.recommendation}`);
  }

  lines.push('');
  return lines.join('\n');
}
