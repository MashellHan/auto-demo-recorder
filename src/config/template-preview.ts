/**
 * Template preview — render scaffold templates with metadata
 * so users can inspect generated YAML before writing to disk.
 */

import type { Scaffold } from './scaffold.js';

/** Template preview result. */
export interface TemplatePreview {
  /** Scaffold metadata. */
  readonly scaffold: Scaffold;
  /** Number of scenarios in the template. */
  readonly scenarioCount: number;
  /** Scenario names extracted from the YAML. */
  readonly scenarioNames: readonly string[];
  /** Whether recording settings are customized. */
  readonly hasCustomRecording: boolean;
  /** Whether browser scenarios are included. */
  readonly hasBrowserScenarios: boolean;
  /** Estimated YAML line count. */
  readonly lineCount: number;
}

/**
 * Generate a preview of a scaffold template.
 */
export function previewTemplate(scaffold: Scaffold): TemplatePreview {
  const lines = scaffold.yaml.split('\n');
  const scenarioNames = extractScenarioNames(scaffold.yaml);

  return {
    scaffold,
    scenarioCount: scenarioNames.length,
    scenarioNames,
    hasCustomRecording: scaffold.yaml.includes('recording:'),
    hasBrowserScenarios: scaffold.yaml.includes('browser_scenarios:'),
    lineCount: lines.length,
  };
}

/**
 * Extract scenario names from YAML content using pattern matching.
 */
function extractScenarioNames(yaml: string): readonly string[] {
  const names: string[] = [];
  const namePattern = /^\s+- name:\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = namePattern.exec(yaml)) !== null) {
    names.push(match[1].trim());
  }
  return names;
}

/**
 * Format a template preview for display.
 */
export function formatTemplatePreview(preview: TemplatePreview): string {
  const lines: string[] = [];
  lines.push('Template Preview');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`  Name:        ${preview.scaffold.name}`);
  lines.push(`  ID:          ${preview.scaffold.id}`);
  lines.push(`  Category:    ${preview.scaffold.category}`);
  lines.push(`  Description: ${preview.scaffold.description}`);
  lines.push('');
  lines.push(`  Scenarios:   ${preview.scenarioCount}`);

  if (preview.scenarioNames.length > 0) {
    for (const name of preview.scenarioNames) {
      lines.push(`    • ${name}`);
    }
  }

  lines.push('');
  const features: string[] = [];
  if (preview.hasCustomRecording) features.push('custom recording settings');
  if (preview.hasBrowserScenarios) features.push('browser scenarios');
  if (features.length > 0) {
    lines.push(`  Features:    ${features.join(', ')}`);
  }
  lines.push(`  YAML lines:  ${preview.lineCount}`);
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push(preview.scaffold.yaml);

  return lines.join('\n');
}

/**
 * Format a compact preview (without full YAML) for listing.
 */
export function formatCompactPreview(preview: TemplatePreview): string {
  const scenarios = preview.scenarioNames.length > 0
    ? preview.scenarioNames.join(', ')
    : 'none';
  return `${preview.scaffold.id.padEnd(20)} ${preview.scaffold.category.padEnd(10)} ${preview.scenarioCount} scenarios (${scenarios})`;
}
