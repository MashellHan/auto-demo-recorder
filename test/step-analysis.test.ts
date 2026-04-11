import { describe, it, expect } from 'vitest';
import { analyzeSteps, formatStepAnalysis } from '../src/analytics/step-analysis.js';
import { ConfigSchema } from '../src/config/schema.js';

function makeConfig(overrides: Record<string, unknown> = {}): any {
  const base = ConfigSchema.parse({
    project: { name: 'test-project', description: 'test' },
    scenarios: [
      {
        name: 'basic',
        description: 'Basic',
        steps: [
          { action: 'type', value: 'echo hello' },
          { action: 'key', value: 'Enter' },
          { action: 'sleep', value: '1s' },
        ],
      },
    ],
  });
  return { ...base, ...overrides };
}

describe('analyzeSteps', () => {
  it('counts step types', () => {
    const config = makeConfig();
    const result = analyzeSteps(config);
    expect(result.totalSteps).toBe(3);
    expect(result.typeStats).toHaveLength(3);
    const typeAction = result.typeStats.find((s) => s.action === 'type');
    expect(typeAction).toBeDefined();
    expect(typeAction!.count).toBe(1);
  });

  it('calculates percentages', () => {
    const config = makeConfig();
    const result = analyzeSteps(config);
    const total = result.typeStats.reduce((sum, s) => sum + s.percentage, 0);
    expect(total).toBeGreaterThanOrEqual(99); // rounding may not sum to exactly 100
  });

  it('handles multiple scenarios', () => {
    const config = makeConfig({
      scenarios: [
        { name: 'a', description: 'A', steps: [{ action: 'type', value: 'x' }] },
        { name: 'b', description: 'B', steps: [{ action: 'type', value: 'y' }, { action: 'key', value: 'q' }] },
      ],
    });
    const result = analyzeSteps(config);
    expect(result.totalSteps).toBe(3);
    expect(result.totalScenarios).toBe(2);
    expect(result.avgStepsPerScenario).toBe(2); // round(3/2) = 2
  });

  it('computes scenario complexity', () => {
    const config = makeConfig({
      scenarios: [
        {
          name: 'complex',
          description: 'Complex scenario',
          setup: ['npm install', 'npm run build'],
          steps: [
            { action: 'type', value: 'a' },
            { action: 'key', value: 'b' },
            { action: 'sleep', value: '1s' },
            { action: 'screenshot', value: 'x' },
          ],
          hooks: { before: 'echo before', after: 'echo after' },
          depends_on: ['setup'],
        },
      ],
    });
    const result = analyzeSteps(config);
    expect(result.scenarios[0].complexityScore).toBeGreaterThan(3);
    expect(result.scenarios[0].hasSetup).toBe(true);
    expect(result.scenarios[0].hasHooks).toBe(true);
    expect(result.scenarios[0].hasDependencies).toBe(true);
  });

  it('identifies most complex scenario', () => {
    const config = makeConfig({
      scenarios: [
        { name: 'simple', description: 'S', steps: [{ action: 'type', value: 'x' }] },
        {
          name: 'complex', description: 'C',
          steps: [
            { action: 'type', value: 'a' },
            { action: 'key', value: 'b' },
            { action: 'sleep', value: '1s' },
            { action: 'type', value: 'c' },
            { action: 'key', value: 'd' },
          ],
          setup: ['npm install'],
        },
      ],
    });
    const result = analyzeSteps(config);
    expect(result.mostComplex!.name).toBe('complex');
  });

  it('handles empty scenarios', () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = analyzeSteps(config);
    expect(result.totalSteps).toBe(0);
    expect(result.totalScenarios).toBe(0);
    expect(result.mostComplex).toBeNull();
  });

  it('tracks scenario count per action', () => {
    const config = makeConfig({
      scenarios: [
        { name: 'a', description: 'A', steps: [{ action: 'type', value: 'x' }] },
        { name: 'b', description: 'B', steps: [{ action: 'type', value: 'y' }] },
      ],
    });
    const result = analyzeSteps(config);
    const typeStats = result.typeStats.find((s) => s.action === 'type');
    expect(typeStats!.scenarioCount).toBe(2);
  });
});

describe('formatStepAnalysis', () => {
  it('formats analysis report', () => {
    const config = makeConfig();
    const result = analyzeSteps(config);
    const text = formatStepAnalysis(result);
    expect(text).toContain('Step Analysis');
    expect(text).toContain('Step Type Distribution');
    expect(text).toContain('Scenario Complexity');
    expect(text).toContain('type');
    expect(text).toContain('basic');
  });

  it('shows empty message for no scenarios', () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = analyzeSteps(config);
    const text = formatStepAnalysis(result);
    expect(text).toContain('No scenarios to analyze');
  });

  it('shows summary metrics', () => {
    const config = makeConfig();
    const result = analyzeSteps(config);
    const text = formatStepAnalysis(result);
    expect(text).toContain('Total:');
    expect(text).toContain('Average:');
  });
});
