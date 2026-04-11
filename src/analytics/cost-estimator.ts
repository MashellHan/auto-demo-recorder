/**
 * Recording cost estimator — estimates API costs for AI annotation.
 *
 * Helps users budget for annotation runs by calculating expected token
 * usage and costs based on frame count, model, and resolution.
 */

/** Pricing per 1M tokens for supported models. */
export interface ModelPricing {
  readonly name: string;
  readonly inputPer1M: number;
  readonly outputPer1M: number;
  /** Estimated input tokens per frame (image + prompt). */
  readonly inputTokensPerFrame: number;
  /** Estimated output tokens per frame (annotation response). */
  readonly outputTokensPerFrame: number;
}

/** Known model pricing table. */
const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4-vision': {
    name: 'GPT-4 Vision',
    inputPer1M: 10.0,
    outputPer1M: 30.0,
    inputTokensPerFrame: 850,
    outputTokensPerFrame: 300,
  },
  'gpt-4o': {
    name: 'GPT-4o',
    inputPer1M: 2.5,
    outputPer1M: 10.0,
    inputTokensPerFrame: 850,
    outputTokensPerFrame: 300,
  },
  'claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    inputTokensPerFrame: 800,
    outputTokensPerFrame: 250,
  },
  'claude-3-haiku': {
    name: 'Claude 3 Haiku',
    inputPer1M: 0.25,
    outputPer1M: 1.25,
    inputTokensPerFrame: 800,
    outputTokensPerFrame: 250,
  },
};

/** Default fallback pricing for unknown models. */
const FALLBACK_PRICING: ModelPricing = {
  name: 'Unknown Model',
  inputPer1M: 5.0,
  outputPer1M: 15.0,
  inputTokensPerFrame: 850,
  outputTokensPerFrame: 300,
};

/** Cost estimate for a single scenario. */
export interface ScenarioCostEstimate {
  readonly scenarioName: string;
  readonly frameCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly inputCost: number;
  readonly outputCost: number;
  readonly totalCost: number;
}

/** Complete cost estimate across all scenarios. */
export interface CostEstimate {
  readonly model: string;
  readonly modelDisplayName: string;
  readonly scenarios: readonly ScenarioCostEstimate[];
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalCost: number;
}

/** Scenario info needed for estimation. */
export interface EstimateScenarioInput {
  readonly name: string;
  readonly steps: readonly unknown[];
  /** Optional: estimated duration in seconds (used to calculate frame count). */
  readonly estimatedDurationSeconds?: number;
}

/**
 * Estimate the annotation cost for a set of scenarios.
 *
 * @param model - The AI model identifier (e.g., "gpt-4o", "claude-3.5-sonnet").
 * @param scenarios - Scenarios to estimate.
 * @param extractFps - Frames per second for extraction (default: 2).
 * @returns Cost estimate with per-scenario breakdown.
 */
export function estimateCost(
  model: string,
  scenarios: readonly EstimateScenarioInput[],
  extractFps = 2,
): CostEstimate {
  const pricing = MODEL_PRICING[model] ?? { ...FALLBACK_PRICING, name: model };

  const scenarioEstimates: ScenarioCostEstimate[] = scenarios.map((scenario) => {
    const duration = scenario.estimatedDurationSeconds ?? estimateDuration(scenario.steps.length);
    const frameCount = Math.max(1, Math.ceil(duration * extractFps));
    const inputTokens = frameCount * pricing.inputTokensPerFrame;
    const outputTokens = frameCount * pricing.outputTokensPerFrame;
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

    return {
      scenarioName: scenario.name,
      frameCount,
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  });

  const totalInputTokens = scenarioEstimates.reduce((sum, s) => sum + s.inputTokens, 0);
  const totalOutputTokens = scenarioEstimates.reduce((sum, s) => sum + s.outputTokens, 0);
  const totalCost = scenarioEstimates.reduce((sum, s) => sum + s.totalCost, 0);

  return {
    model,
    modelDisplayName: pricing.name,
    scenarios: scenarioEstimates,
    totalInputTokens,
    totalOutputTokens,
    totalCost,
  };
}

/**
 * Estimate recording duration from step count.
 * Rough heuristic: ~3 seconds per step.
 */
function estimateDuration(stepCount: number): number {
  return Math.max(5, stepCount * 3);
}

/**
 * Get available model names for estimation.
 */
export function getEstimateModels(): string[] {
  return Object.keys(MODEL_PRICING);
}

/**
 * Format a cost estimate as a human-readable report.
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  const lines: string[] = [];
  lines.push('Annotation Cost Estimate');
  lines.push('═'.repeat(50));
  lines.push(`  Model: ${estimate.modelDisplayName} (${estimate.model})`);
  lines.push('');

  if (estimate.scenarios.length > 1) {
    lines.push('  Per-Scenario Breakdown:');
    lines.push('  ' + '─'.repeat(48));
    for (const s of estimate.scenarios) {
      lines.push(`  ${s.scenarioName.padEnd(24)} ${s.frameCount} frames  $${s.totalCost.toFixed(4)}`);
    }
    lines.push('  ' + '─'.repeat(48));
    lines.push('');
  }

  lines.push(`  Total Frames:        ${estimate.scenarios.reduce((sum, s) => sum + s.frameCount, 0)}`);
  lines.push(`  Input Tokens:        ${estimate.totalInputTokens.toLocaleString()}`);
  lines.push(`  Output Tokens:       ${estimate.totalOutputTokens.toLocaleString()}`);
  lines.push(`  Estimated Cost:      $${estimate.totalCost.toFixed(4)}`);

  return lines.join('\n');
}
