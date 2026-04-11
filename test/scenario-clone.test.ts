import { describe, it, expect } from 'vitest';
import {
  cloneScenario,
  cloneBrowserScenario,
  batchClone,
  formatCloneSummary,
} from '../src/config/scenario-clone.js';
import type { Scenario, BrowserScenario } from '../src/config/schema.js';

const baseScenario: Scenario = {
  name: 'original',
  description: 'Original scenario',
  setup: ['npm install'],
  steps: [
    { action: 'type', value: 'echo hello', pause: '500ms' },
    { action: 'key', value: 'Enter', pause: '500ms' },
  ],
  tags: ['smoke'],
  depends_on: [],
};

const baseBrowserScenario: BrowserScenario = {
  name: 'browser-original',
  description: 'Browser scenario',
  url: 'http://localhost:3000',
  setup: [],
  steps: [
    { action: 'click', value: '#btn', pause: '500ms' },
  ],
  tags: ['e2e'],
  depends_on: [],
};

describe('cloneScenario', () => {
  it('clones with a new name', () => {
    const cloned = cloneScenario(baseScenario, { name: 'clone-1' });
    expect(cloned.name).toBe('clone-1');
    expect(cloned.description).toBe('Clone of original');
    expect(cloned.steps).toEqual(baseScenario.steps);
    expect(cloned.setup).toEqual(['npm install']);
    expect(cloned.tags).toEqual(['smoke']);
  });

  it('does not mutate the original', () => {
    const cloned = cloneScenario(baseScenario, { name: 'mutant', tags: ['regression'] });
    expect(baseScenario.tags).toEqual(['smoke']);
    expect(cloned.tags).toEqual(['regression']);
  });

  it('accepts description override', () => {
    const cloned = cloneScenario(baseScenario, { name: 'c', description: 'Custom desc' });
    expect(cloned.description).toBe('Custom desc');
  });

  it('appends steps', () => {
    const cloned = cloneScenario(baseScenario, {
      name: 'c',
      appendSteps: [{ action: 'key', value: 'q', pause: '100ms' }],
    });
    expect(cloned.steps).toHaveLength(3);
    expect(cloned.steps[2].value).toBe('q');
  });

  it('prepends steps', () => {
    const cloned = cloneScenario(baseScenario, {
      name: 'c',
      prependSteps: [{ action: 'sleep', value: '1s', pause: '0ms' }],
    });
    expect(cloned.steps).toHaveLength(3);
    expect(cloned.steps[0].action).toBe('sleep');
  });

  it('overrides setup', () => {
    const cloned = cloneScenario(baseScenario, { name: 'c', setup: ['yarn install'] });
    expect(cloned.setup).toEqual(['yarn install']);
  });

  it('overrides depends_on', () => {
    const cloned = cloneScenario(baseScenario, { name: 'c', dependsOn: ['setup'] });
    expect(cloned.depends_on).toEqual(['setup']);
  });
});

describe('cloneBrowserScenario', () => {
  it('clones with new name and URL override', () => {
    const cloned = cloneBrowserScenario(baseBrowserScenario, {
      name: 'browser-clone',
      url: 'http://localhost:4000',
    });
    expect(cloned.name).toBe('browser-clone');
    expect(cloned.url).toBe('http://localhost:4000');
    expect(cloned.steps).toEqual(baseBrowserScenario.steps);
  });

  it('preserves original URL when not overridden', () => {
    const cloned = cloneBrowserScenario(baseBrowserScenario, { name: 'clone' });
    expect(cloned.url).toBe('http://localhost:3000');
  });
});

describe('batchClone', () => {
  it('creates multiple variants', () => {
    const result = batchClone(baseScenario, [
      { tags: ['regression'] },
      { tags: ['performance'] },
      { tags: ['accessibility'] },
    ]);
    expect(result.cloned).toHaveLength(3);
    expect(result.names).toEqual([
      'original-variant-1',
      'original-variant-2',
      'original-variant-3',
    ]);
  });

  it('uses custom name prefix', () => {
    const result = batchClone(baseScenario, [{}], 'test');
    expect(result.names[0]).toBe('test-variant-1');
  });

  it('uses custom names when provided', () => {
    const result = batchClone(baseScenario, [
      { name: 'custom-a' },
      { name: 'custom-b' },
    ]);
    expect(result.names).toEqual(['custom-a', 'custom-b']);
  });

  it('returns empty for no variants', () => {
    const result = batchClone(baseScenario, []);
    expect(result.cloned).toHaveLength(0);
  });
});

describe('formatCloneSummary', () => {
  it('formats clone summary', () => {
    const text = formatCloneSummary('base', [
      { name: 'clone-1' },
      { name: 'clone-2' },
    ]);
    expect(text).toContain('Cloned from "base"');
    expect(text).toContain('→ clone-1');
    expect(text).toContain('→ clone-2');
    expect(text).toContain('2 variant(s)');
  });
});
