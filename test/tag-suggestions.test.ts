import { describe, it, expect } from 'vitest';
import { suggestTags, formatTagSuggestions } from '../src/analytics/tag-suggestions.js';
import { ConfigSchema } from '../src/config/schema.js';

function makeConfig(overrides: Record<string, unknown> = {}): any {
  const base = ConfigSchema.parse({
    project: { name: 'test-project', description: 'test' },
    scenarios: [
      {
        name: 'basic',
        description: 'Basic test',
        steps: [
          { action: 'type', value: 'echo hello' },
          { action: 'key', value: 'Enter' },
        ],
      },
    ],
  });
  return { ...base, ...overrides };
}

describe('suggestTags', () => {
  it('suggests setup tag for setup scenario', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'setup-environment',
        description: 'Set up the development environment',
        steps: [{ action: 'type', value: 'npm install' }],
      }],
    });
    const result = suggestTags(config);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    const suggestion = result.suggestions[0];
    expect(suggestion.suggestedTags).toContain('setup');
  });

  it('suggests api tag for curl commands', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'api-check',
        description: 'Check API endpoints',
        steps: [
          { action: 'type', value: 'curl http://localhost:8080/api/health' },
          { action: 'key', value: 'Enter' },
        ],
      }],
    });
    const result = suggestTags(config);
    const suggestion = result.suggestions.find((s) => s.scenario === 'api-check');
    expect(suggestion).toBeDefined();
    expect(suggestion!.suggestedTags).toContain('api');
  });

  it('suggests build tag for build commands', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'compile',
        description: 'Compile the project',
        steps: [
          { action: 'type', value: 'npm run build' },
          { action: 'key', value: 'Enter' },
        ],
      }],
    });
    const result = suggestTags(config);
    const suggestion = result.suggestions.find((s) => s.scenario === 'compile');
    expect(suggestion).toBeDefined();
    expect(suggestion!.suggestedTags).toContain('build');
  });

  it('suggests test tag for test commands', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'run-tests',
        description: 'Run the test suite',
        steps: [
          { action: 'type', value: 'npm test' },
          { action: 'key', value: 'Enter' },
        ],
      }],
    });
    const result = suggestTags(config);
    const suggestion = result.suggestions.find((s) => s.scenario === 'run-tests');
    expect(suggestion).toBeDefined();
    expect(suggestion!.suggestedTags).toContain('test');
  });

  it('does not suggest existing tags', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'setup-project',
        description: 'Project setup',
        tags: ['setup'],
        steps: [{ action: 'type', value: 'npm install' }],
      }],
    });
    const result = suggestTags(config);
    const suggestion = result.suggestions.find((s) => s.scenario === 'setup-project');
    if (suggestion) {
      expect(suggestion.suggestedTags).not.toContain('setup');
    }
  });

  it('counts well-tagged scenarios', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'basic',
        description: 'Basic',
        tags: ['core'],
        steps: [{ action: 'type', value: 'echo hi' }],
      }],
    });
    const result = suggestTags(config);
    expect(result.wellTaggedCount).toBe(1);
  });

  it('handles empty scenarios', () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = suggestTags(config);
    expect(result.totalScenarios).toBe(0);
    expect(result.suggestions.length).toBe(0);
  });

  it('suggests interactive tag for many key steps', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'vim-demo',
        description: 'Vim editor demo',
        steps: [
          { action: 'key', value: 'i' },
          { action: 'key', value: 'Escape' },
          { action: 'key', value: 'j' },
          { action: 'key', value: 'k' },
          { action: 'key', value: 'Enter' },
        ],
      }],
    });
    const result = suggestTags(config);
    const suggestion = result.suggestions.find((s) => s.scenario === 'vim-demo');
    expect(suggestion).toBeDefined();
    expect(suggestion!.suggestedTags).toContain('interactive');
  });

  it('suggests demo tag for demo-named scenarios', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'feature-demo',
        description: 'Showcase new features',
        steps: [{ action: 'type', value: 'echo demo' }],
      }],
    });
    const result = suggestTags(config);
    const suggestion = result.suggestions.find((s) => s.scenario === 'feature-demo');
    expect(suggestion).toBeDefined();
    expect(suggestion!.suggestedTags).toContain('demo');
  });

  it('provides reasons for each suggestion', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'setup',
        description: 'Setup scenario',
        steps: [{ action: 'type', value: 'npm install' }],
      }],
    });
    const result = suggestTags(config);
    expect(result.suggestions[0].reasons.length).toBeGreaterThan(0);
    expect(result.suggestions[0].reasons.length).toBe(result.suggestions[0].suggestedTags.length);
  });
});

describe('formatTagSuggestions', () => {
  it('formats suggestions', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'setup',
        description: 'Setup',
        steps: [{ action: 'type', value: 'npm install' }],
      }],
    });
    const result = suggestTags(config);
    const text = formatTagSuggestions(result);
    expect(text).toContain('Tag Suggestions');
    expect(text).toContain('setup');
  });

  it('formats empty scenarios', () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = suggestTags(config);
    const text = formatTagSuggestions(result);
    expect(text).toContain('No scenarios');
  });

  it('shows well-tagged message', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'basic',
        description: 'Basic',
        tags: ['core'],
        steps: [{ action: 'type', value: 'echo hi' }],
      }],
    });
    const result = suggestTags(config);
    const text = formatTagSuggestions(result);
    expect(text).toContain('well-tagged');
  });

  it('shows summary count', () => {
    const config = makeConfig({
      scenarios: [{
        name: 'setup',
        description: 'Setup',
        steps: [{ action: 'type', value: 'npm install' }],
      }],
    });
    const result = suggestTags(config);
    const text = formatTagSuggestions(result);
    expect(text).toContain('Summary:');
  });
});
