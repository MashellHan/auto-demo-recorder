/**
 * Config diff tool — compares two demo-recorder config objects and reports differences.
 *
 * Useful for understanding what changed between config versions, comparing
 * profiles, or validating migration results.
 */

/** A single difference between two config values. */
export interface ConfigDifference {
  /** Dot-separated path to the changed field (e.g., "recording.format"). */
  readonly path: string;
  /** Type of change. */
  readonly type: 'added' | 'removed' | 'changed';
  /** Old value (undefined for additions). */
  readonly oldValue?: unknown;
  /** New value (undefined for removals). */
  readonly newValue?: unknown;
}

/** Complete diff result between two configs. */
export interface ConfigDiffResult {
  /** List of all differences found. */
  readonly differences: readonly ConfigDifference[];
  /** Whether the two configs are identical. */
  readonly identical: boolean;
  /** Count of additions. */
  readonly added: number;
  /** Count of removals. */
  readonly removed: number;
  /** Count of value changes. */
  readonly changed: number;
}

/**
 * Compare two config objects recursively and return all differences.
 *
 * @param oldConfig - The original/baseline config object.
 * @param newConfig - The new/updated config object.
 * @param prefix - Internal: current path prefix for recursion.
 * @returns A ConfigDiffResult with all differences.
 */
export function diffConfigs(
  oldConfig: Record<string, unknown>,
  newConfig: Record<string, unknown>,
  prefix = '',
): ConfigDiffResult {
  const differences: ConfigDifference[] = [];
  collectDiffs(oldConfig, newConfig, prefix, differences);

  return {
    differences,
    identical: differences.length === 0,
    added: differences.filter((d) => d.type === 'added').length,
    removed: differences.filter((d) => d.type === 'removed').length,
    changed: differences.filter((d) => d.type === 'changed').length,
  };
}

function collectDiffs(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  prefix: string,
  diffs: ConfigDifference[],
): void {
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of [...allKeys].sort()) {
    const path = prefix ? `${prefix}.${key}` : key;
    const hasOld = key in oldObj;
    const hasNew = key in newObj;

    if (!hasOld && hasNew) {
      diffs.push({ path, type: 'added', newValue: newObj[key] });
      continue;
    }

    if (hasOld && !hasNew) {
      diffs.push({ path, type: 'removed', oldValue: oldObj[key] });
      continue;
    }

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (isPlainObject(oldVal) && isPlainObject(newVal)) {
      collectDiffs(
        oldVal as Record<string, unknown>,
        newVal as Record<string, unknown>,
        path,
        diffs,
      );
      continue;
    }

    if (!deepEqual(oldVal, newVal)) {
      diffs.push({ path, type: 'changed', oldValue: oldVal, newValue: newVal });
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => key in b && deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Format a config diff result as a human-readable string.
 */
export function formatConfigDiff(result: ConfigDiffResult): string {
  if (result.identical) {
    return 'Configs are identical.';
  }

  const lines: string[] = [];
  lines.push('Config Differences:');
  lines.push('═'.repeat(50));
  lines.push('');

  for (const diff of result.differences) {
    const icon = diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~';
    const label = diff.type === 'added' ? 'ADDED' : diff.type === 'removed' ? 'REMOVED' : 'CHANGED';

    lines.push(`  ${icon} [${label}] ${diff.path}`);

    if (diff.type === 'changed') {
      lines.push(`      Old: ${formatValue(diff.oldValue)}`);
      lines.push(`      New: ${formatValue(diff.newValue)}`);
    } else if (diff.type === 'added') {
      lines.push(`      Value: ${formatValue(diff.newValue)}`);
    } else {
      lines.push(`      Was: ${formatValue(diff.oldValue)}`);
    }
    lines.push('');
  }

  lines.push(`Summary: ${result.added} added, ${result.removed} removed, ${result.changed} changed`);
  return lines.join('\n');
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) {
    if (value.length <= 3) return JSON.stringify(value);
    return `[${value.length} items]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length <= 3) return JSON.stringify(value);
    return `{${keys.length} fields}`;
  }
  return String(value);
}
