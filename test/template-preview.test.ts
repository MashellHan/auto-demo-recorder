import { describe, it, expect } from 'vitest';
import { previewTemplate, formatTemplatePreview, formatCompactPreview } from '../src/config/template-preview.js';
import type { Scaffold } from '../src/config/scaffold.js';

function makeScaffold(overrides: Partial<Scaffold> = {}): Scaffold {
  return {
    id: 'test-scaffold',
    name: 'Test Scaffold',
    description: 'A test scaffold template',
    category: 'cli',
    yaml: `# Test config
project:
  name: test

scenarios:
  - name: basic
    description: Basic test
    steps:
      - action: type
        value: echo hello
  - name: advanced
    description: Advanced test
    steps:
      - action: type
        value: echo world
`,
    ...overrides,
  };
}

describe('previewTemplate', () => {
  it('extracts scenario count', () => {
    const preview = previewTemplate(makeScaffold());
    expect(preview.scenarioCount).toBe(2);
  });

  it('extracts scenario names', () => {
    const preview = previewTemplate(makeScaffold());
    expect(preview.scenarioNames).toEqual(['basic', 'advanced']);
  });

  it('detects custom recording settings', () => {
    const withRecording = makeScaffold({
      yaml: `project:
  name: test
recording:
  fps: 60
scenarios:
  - name: basic
    steps: []
`,
    });
    expect(previewTemplate(withRecording).hasCustomRecording).toBe(true);
    expect(previewTemplate(makeScaffold()).hasCustomRecording).toBe(false);
  });

  it('detects browser scenarios', () => {
    const withBrowser = makeScaffold({
      yaml: `project:
  name: test
scenarios:
  - name: basic
    steps: []
browser_scenarios:
  - name: web-test
    url: http://localhost
    steps: []
`,
    });
    expect(previewTemplate(withBrowser).hasBrowserScenarios).toBe(true);
    expect(previewTemplate(makeScaffold()).hasBrowserScenarios).toBe(false);
  });

  it('counts YAML lines', () => {
    const preview = previewTemplate(makeScaffold());
    expect(preview.lineCount).toBeGreaterThan(5);
  });

  it('preserves scaffold metadata', () => {
    const scaffold = makeScaffold({ id: 'my-id', name: 'My Template', category: 'web' });
    const preview = previewTemplate(scaffold);
    expect(preview.scaffold.id).toBe('my-id');
    expect(preview.scaffold.name).toBe('My Template');
    expect(preview.scaffold.category).toBe('web');
  });

  it('handles scaffold with no scenarios', () => {
    const noScenarios = makeScaffold({
      yaml: `project:
  name: empty
`,
    });
    const preview = previewTemplate(noScenarios);
    expect(preview.scenarioCount).toBe(0);
    expect(preview.scenarioNames).toEqual([]);
  });
});

describe('formatTemplatePreview', () => {
  it('includes template metadata', () => {
    const preview = previewTemplate(makeScaffold());
    const text = formatTemplatePreview(preview);
    expect(text).toContain('Template Preview');
    expect(text).toContain('Test Scaffold');
    expect(text).toContain('test-scaffold');
    expect(text).toContain('cli');
  });

  it('lists scenario names', () => {
    const preview = previewTemplate(makeScaffold());
    const text = formatTemplatePreview(preview);
    expect(text).toContain('basic');
    expect(text).toContain('advanced');
  });

  it('includes full YAML', () => {
    const preview = previewTemplate(makeScaffold());
    const text = formatTemplatePreview(preview);
    expect(text).toContain('echo hello');
    expect(text).toContain('echo world');
  });

  it('shows features when present', () => {
    const scaffold = makeScaffold({
      yaml: `project:
  name: test
recording:
  fps: 60
browser_scenarios:
  - name: web
    url: http://localhost
    steps: []
scenarios:
  - name: basic
    steps: []
`,
    });
    const preview = previewTemplate(scaffold);
    const text = formatTemplatePreview(preview);
    expect(text).toContain('custom recording settings');
    expect(text).toContain('browser scenarios');
  });
});

describe('formatCompactPreview', () => {
  it('shows compact info', () => {
    const preview = previewTemplate(makeScaffold());
    const text = formatCompactPreview(preview);
    expect(text).toContain('test-scaffold');
    expect(text).toContain('cli');
    expect(text).toContain('2 scenarios');
    expect(text).toContain('basic');
  });
});
