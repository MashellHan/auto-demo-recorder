/**
 * Config snapshot diff — compare the current config against a
 * previously saved snapshot to detect configuration drift.
 *
 * Leverages the existing config comparison module for structural
 * difference detection.
 */

import type { Config } from './schema.js';
import { compareConfigs } from './config-comparison.js';
import type { ComparisonReport, ConfigChange } from './config-comparison.js';

/** Config snapshot — a point-in-time capture of config state. */
export interface ConfigSnapshot {
  /** Snapshot creation timestamp. */
  readonly timestamp: string;
  /** Snapshot label. */
  readonly label: string;
  /** The captured config. */
  readonly config: Config;
}

/** Config drift detection result. */
export interface DriftResult {
  /** Whether drift was detected. */
  readonly hasDrift: boolean;
  /** The comparison report. */
  readonly comparison: ComparisonReport;
  /** Snapshot metadata. */
  readonly snapshot: { readonly timestamp: string; readonly label: string };
  /** Summary of drift. */
  readonly driftSummary: string;
}

/**
 * Create a config snapshot.
 */
export function createConfigSnapshot(config: Config, label: string): ConfigSnapshot {
  return {
    timestamp: new Date().toISOString(),
    label,
    config,
  };
}

/**
 * Detect drift between current config and a snapshot.
 */
export function detectDrift(
  snapshot: ConfigSnapshot,
  currentConfig: Config,
): DriftResult {
  const comparison = compareConfigs(snapshot.config, currentConfig);

  const driftParts: string[] = [];
  if (comparison.summary.added > 0) driftParts.push(`${comparison.summary.added} added`);
  if (comparison.summary.removed > 0) driftParts.push(`${comparison.summary.removed} removed`);
  if (comparison.summary.modified > 0) driftParts.push(`${comparison.summary.modified} modified`);
  const driftSummary = driftParts.length > 0
    ? driftParts.join(', ')
    : 'No drift detected';

  return {
    hasDrift: !comparison.identical,
    comparison,
    snapshot: {
      timestamp: snapshot.timestamp,
      label: snapshot.label,
    },
    driftSummary,
  };
}

/**
 * Classify drift severity.
 */
export function classifyDriftSeverity(changes: readonly ConfigChange[]): 'none' | 'low' | 'medium' | 'high' {
  if (changes.length === 0) return 'none';

  const hasScenarioChanges = changes.some(
    (c) => c.category === 'scenario' && (c.type === 'added' || c.type === 'removed'),
  );
  const hasRecordingChanges = changes.some((c) => c.category === 'recording');
  const hasMultipleChanges = changes.length > 5;

  if (hasScenarioChanges && hasRecordingChanges) return 'high';
  if (hasScenarioChanges || hasMultipleChanges) return 'medium';
  return 'low';
}

/**
 * Format drift detection report.
 */
export function formatDrift(result: DriftResult): string {
  const lines: string[] = [];
  lines.push('Config Drift Report');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`  Snapshot: "${result.snapshot.label}" (${result.snapshot.timestamp})`);
  lines.push('');

  if (!result.hasDrift) {
    lines.push('  ✓ No drift detected — config matches snapshot.');
    return lines.join('\n');
  }

  const severity = classifyDriftSeverity(result.comparison.changes);
  const severityIcons = { none: '✓', low: '🟢', medium: '🟡', high: '🔴' };

  lines.push(`  ${severityIcons[severity]} Drift detected (${severity} severity)`);
  lines.push(`  Changes: ${result.driftSummary}`);
  lines.push('');

  const grouped = {
    added: result.comparison.changes.filter((c) => c.type === 'added'),
    removed: result.comparison.changes.filter((c) => c.type === 'removed'),
    modified: result.comparison.changes.filter((c) => c.type === 'modified'),
  };

  if (grouped.added.length > 0) {
    lines.push('  Added:');
    for (const c of grouped.added) lines.push(`    + ${c.description}`);
    lines.push('');
  }

  if (grouped.removed.length > 0) {
    lines.push('  Removed:');
    for (const c of grouped.removed) lines.push(`    - ${c.description}`);
    lines.push('');
  }

  if (grouped.modified.length > 0) {
    lines.push('  Modified:');
    for (const c of grouped.modified) lines.push(`    ~ ${c.description}`);
    lines.push('');
  }

  return lines.join('\n');
}
