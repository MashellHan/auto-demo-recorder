import { describe, it, expect } from 'vitest';
import {
  estimateCost,
  getEstimateModels,
  formatCostEstimate,
} from '../src/analytics/cost-estimator.js';

describe('estimateCost', () => {
  it('estimates cost for a single scenario', () => {
    const estimate = estimateCost('gpt-4o', [
      { name: 'basic', steps: [1, 2, 3, 4, 5], estimatedDurationSeconds: 10 },
    ]);
    expect(estimate.model).toBe('gpt-4o');
    expect(estimate.modelDisplayName).toBe('GPT-4o');
    expect(estimate.scenarios).toHaveLength(1);
    expect(estimate.scenarios[0].frameCount).toBe(20); // 10s * 2fps
    expect(estimate.totalCost).toBeGreaterThan(0);
  });

  it('estimates cost for multiple scenarios', () => {
    const estimate = estimateCost('claude-3.5-sonnet', [
      { name: 'basic', steps: [1, 2], estimatedDurationSeconds: 5 },
      { name: 'advanced', steps: [1, 2, 3], estimatedDurationSeconds: 15 },
    ]);
    expect(estimate.scenarios).toHaveLength(2);
    expect(estimate.totalCost).toBe(
      estimate.scenarios[0].totalCost + estimate.scenarios[1].totalCost,
    );
  });

  it('uses fallback pricing for unknown model', () => {
    const estimate = estimateCost('unknown-model-xyz', [
      { name: 'test', steps: [1], estimatedDurationSeconds: 5 },
    ]);
    expect(estimate.modelDisplayName).toBe('unknown-model-xyz');
    expect(estimate.totalCost).toBeGreaterThan(0);
  });

  it('handles zero-step scenario with minimum duration', () => {
    const estimate = estimateCost('gpt-4o', [
      { name: 'empty', steps: [] },
    ]);
    // estimateDuration(0) = max(5, 0*3) = 5s → 10 frames at 2fps
    expect(estimate.scenarios[0].frameCount).toBe(10);
    expect(estimate.totalCost).toBeGreaterThan(0);
  });

  it('respects custom extractFps', () => {
    const est2fps = estimateCost('gpt-4o', [
      { name: 'test', steps: [1], estimatedDurationSeconds: 10 },
    ], 2);
    const est5fps = estimateCost('gpt-4o', [
      { name: 'test', steps: [1], estimatedDurationSeconds: 10 },
    ], 5);
    expect(est5fps.scenarios[0].frameCount).toBe(50); // 10s * 5fps
    expect(est2fps.scenarios[0].frameCount).toBe(20); // 10s * 2fps
    expect(est5fps.totalCost).toBeGreaterThan(est2fps.totalCost);
  });

  it('uses step-based duration estimation when no explicit duration', () => {
    const estimate = estimateCost('gpt-4o', [
      { name: 'test', steps: [1, 2, 3, 4, 5] }, // 5 steps * 3s = 15s
    ]);
    expect(estimate.scenarios[0].frameCount).toBe(30); // 15s * 2fps
  });

  it('calculates input and output costs separately', () => {
    const estimate = estimateCost('gpt-4o', [
      { name: 'test', steps: [1], estimatedDurationSeconds: 10 },
    ]);
    const s = estimate.scenarios[0];
    expect(s.inputCost).toBeGreaterThan(0);
    expect(s.outputCost).toBeGreaterThan(0);
    expect(s.totalCost).toBeCloseTo(s.inputCost + s.outputCost, 10);
  });
});

describe('getEstimateModels', () => {
  it('returns known model names', () => {
    const models = getEstimateModels();
    expect(models).toContain('gpt-4o');
    expect(models).toContain('claude-3.5-sonnet');
    expect(models.length).toBeGreaterThanOrEqual(4);
  });
});

describe('formatCostEstimate', () => {
  it('formats a single scenario estimate', () => {
    const estimate = estimateCost('gpt-4o', [
      { name: 'basic', steps: [1, 2, 3], estimatedDurationSeconds: 10 },
    ]);
    const text = formatCostEstimate(estimate);
    expect(text).toContain('Annotation Cost Estimate');
    expect(text).toContain('GPT-4o');
    expect(text).toContain('Estimated Cost');
  });

  it('formats multi-scenario with breakdown', () => {
    const estimate = estimateCost('claude-3.5-sonnet', [
      { name: 'basic', steps: [1], estimatedDurationSeconds: 5 },
      { name: 'advanced', steps: [1, 2, 3], estimatedDurationSeconds: 15 },
    ]);
    const text = formatCostEstimate(estimate);
    expect(text).toContain('Per-Scenario Breakdown');
    expect(text).toContain('basic');
    expect(text).toContain('advanced');
  });

  it('includes token counts', () => {
    const estimate = estimateCost('gpt-4o', [
      { name: 'test', steps: [1], estimatedDurationSeconds: 10 },
    ]);
    const text = formatCostEstimate(estimate);
    expect(text).toContain('Input Tokens');
    expect(text).toContain('Output Tokens');
  });
});
