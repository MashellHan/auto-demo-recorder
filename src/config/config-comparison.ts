/**
 * Structured config comparison report — generate a human-readable
 * report showing differences between two configs.
 *
 * Goes beyond raw diff to show structural changes:
 * - New/removed scenarios
 * - Changed settings with old→new values
 * - Added/removed tags, steps, hooks
 */

import type { Config } from './schema.js';

/** A structural change between two configs. */
export interface ConfigChange {
  /** Change category. */
  readonly category: 'scenario' | 'setting' | 'annotation' | 'recording' | 'output';
  /** Type of change. */
  readonly type: 'added' | 'removed' | 'modified';
  /** Path to the changed value (e.g., "recording.fps"). */
  readonly path: string;
  /** Human-readable description. */
  readonly description: string;
  /** Old value (for modified/removed). */
  readonly oldValue?: unknown;
  /** New value (for modified/added). */
  readonly newValue?: unknown;
}

/** Config comparison report result. */
export interface ComparisonReport {
  /** Detected changes. */
  readonly changes: readonly ConfigChange[];
  /** Whether configs are identical. */
  readonly identical: boolean;
  /** Summary counts. */
  readonly summary: {
    readonly added: number;
    readonly removed: number;
    readonly modified: number;
  };
}

/**
 * Compare two parsed configs and generate a structured report.
 */
export function compareConfigs(configA: Config, configB: Config): ComparisonReport {
  const changes: ConfigChange[] = [];

  // Compare scenarios
  const scenariosA = new Set(configA.scenarios.map((s) => s.name));
  const scenariosB = new Set(configB.scenarios.map((s) => s.name));

  for (const name of scenariosB) {
    if (!scenariosA.has(name)) {
      changes.push({
        category: 'scenario',
        type: 'added',
        path: `scenarios.${name}`,
        description: `New scenario "${name}"`,
        newValue: name,
      });
    }
  }

  for (const name of scenariosA) {
    if (!scenariosB.has(name)) {
      changes.push({
        category: 'scenario',
        type: 'removed',
        path: `scenarios.${name}`,
        description: `Removed scenario "${name}"`,
        oldValue: name,
      });
    }
  }

  // Compare common scenarios for modifications
  for (const name of scenariosA) {
    if (scenariosB.has(name)) {
      const sA = configA.scenarios.find((s) => s.name === name)!;
      const sB = configB.scenarios.find((s) => s.name === name)!;

      if (sA.description !== sB.description) {
        changes.push({
          category: 'scenario',
          type: 'modified',
          path: `scenarios.${name}.description`,
          description: `"${name}" description changed`,
          oldValue: sA.description,
          newValue: sB.description,
        });
      }

      if (sA.steps.length !== sB.steps.length) {
        changes.push({
          category: 'scenario',
          type: 'modified',
          path: `scenarios.${name}.steps`,
          description: `"${name}" step count: ${sA.steps.length} → ${sB.steps.length}`,
          oldValue: sA.steps.length,
          newValue: sB.steps.length,
        });
      }

      const tagsA = (sA.tags ?? []).join(',');
      const tagsB = (sB.tags ?? []).join(',');
      if (tagsA !== tagsB) {
        changes.push({
          category: 'scenario',
          type: 'modified',
          path: `scenarios.${name}.tags`,
          description: `"${name}" tags changed`,
          oldValue: sA.tags,
          newValue: sB.tags,
        });
      }
    }
  }

  // Compare browser scenarios
  const bScenariosA = new Set(configA.browser_scenarios.map((s) => s.name));
  const bScenariosB = new Set(configB.browser_scenarios.map((s) => s.name));

  for (const name of bScenariosB) {
    if (!bScenariosA.has(name)) {
      changes.push({
        category: 'scenario',
        type: 'added',
        path: `browser_scenarios.${name}`,
        description: `New browser scenario "${name}"`,
        newValue: name,
      });
    }
  }

  for (const name of bScenariosA) {
    if (!bScenariosB.has(name)) {
      changes.push({
        category: 'scenario',
        type: 'removed',
        path: `browser_scenarios.${name}`,
        description: `Removed browser scenario "${name}"`,
        oldValue: name,
      });
    }
  }

  // Compare recording settings
  compareSettings(changes, 'recording', configA.recording, configB.recording, ['width', 'height', 'fps', 'theme', 'format', 'backend', 'parallel', 'max_workers', 'max_duration']);

  // Compare output settings
  compareSettings(changes, 'output', configA.output, configB.output, ['dir', 'keep_raw', 'keep_frames', 'record_mode']);

  // Compare annotation settings
  compareSettings(changes, 'annotation', configA.annotation, configB.annotation, ['enabled', 'model', 'extract_fps', 'language']);

  // Compare project settings
  if (configA.project.name !== configB.project.name) {
    changes.push({
      category: 'setting',
      type: 'modified',
      path: 'project.name',
      description: `Project name: "${configA.project.name}" → "${configB.project.name}"`,
      oldValue: configA.project.name,
      newValue: configB.project.name,
    });
  }

  const summary = {
    added: changes.filter((c) => c.type === 'added').length,
    removed: changes.filter((c) => c.type === 'removed').length,
    modified: changes.filter((c) => c.type === 'modified').length,
  };

  return {
    changes,
    identical: changes.length === 0,
    summary,
  };
}

function compareSettings(
  changes: ConfigChange[],
  category: ConfigChange['category'],
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    const vA = (a as Record<string, unknown>)[key];
    const vB = (b as Record<string, unknown>)[key];
    if (JSON.stringify(vA) !== JSON.stringify(vB)) {
      changes.push({
        category,
        type: 'modified',
        path: `${category}.${key}`,
        description: `${category}.${key}: ${JSON.stringify(vA)} → ${JSON.stringify(vB)}`,
        oldValue: vA,
        newValue: vB,
      });
    }
  }
}

/**
 * Format config comparison report.
 */
export function formatComparisonReport(report: ComparisonReport): string {
  const lines: string[] = [];
  lines.push('Config Comparison Report');
  lines.push('═'.repeat(60));
  lines.push('');

  if (report.identical) {
    lines.push('  ✓ Configs are identical.');
    return lines.join('\n');
  }

  const added = report.changes.filter((c) => c.type === 'added');
  const removed = report.changes.filter((c) => c.type === 'removed');
  const modified = report.changes.filter((c) => c.type === 'modified');

  if (added.length > 0) {
    lines.push('  Added:');
    for (const c of added) lines.push(`    + ${c.description}`);
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push('  Removed:');
    for (const c of removed) lines.push(`    - ${c.description}`);
    lines.push('');
  }

  if (modified.length > 0) {
    lines.push('  Modified:');
    for (const c of modified) lines.push(`    ~ ${c.description}`);
    lines.push('');
  }

  lines.push(`  Summary: ${report.summary.added} added, ${report.summary.removed} removed, ${report.summary.modified} modified`);
  return lines.join('\n');
}
