/**
 * Config merge utility — deep-merge two config objects with conflict resolution.
 *
 * Useful for combining a base config with environment-specific overrides,
 * e.g., merging a production config into a development base config.
 *
 * Merge rules:
 * - Scalars: override wins
 * - Arrays: override replaces base (no concatenation)
 * - Objects: recursively merged
 * - Undefined/null in override: base value preserved
 */

/** Describes how a value was resolved during merge. */
export type MergeSource = 'base' | 'override' | 'merged';

/** Record of how each top-level key was resolved. */
export interface MergeResolution {
  /** The config key path (dot notation). */
  readonly path: string;
  /** Which source provided the final value. */
  readonly source: MergeSource;
}

/** Complete merge result. */
export interface MergeResult {
  /** The merged config object. */
  readonly merged: Record<string, unknown>;
  /** How each key was resolved. */
  readonly resolutions: readonly MergeResolution[];
  /** Number of keys from base only. */
  readonly baseOnlyCount: number;
  /** Number of keys overridden. */
  readonly overrideCount: number;
  /** Number of keys that were recursively merged. */
  readonly mergedCount: number;
}

/**
 * Deep-merge two config-like objects.
 * Override values take precedence over base values for scalars and arrays.
 * Objects are recursively merged.
 */
export function mergeConfigs(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): MergeResult {
  const resolutions: MergeResolution[] = [];
  const merged = deepMerge(base, override, '', resolutions);

  const baseOnlyCount = resolutions.filter((r) => r.source === 'base').length;
  const overrideCount = resolutions.filter((r) => r.source === 'override').length;
  const mergedCount = resolutions.filter((r) => r.source === 'merged').length;

  return {
    merged: merged as Record<string, unknown>,
    resolutions,
    baseOnlyCount,
    overrideCount,
    mergedCount,
  };
}

function deepMerge(
  base: unknown,
  override: unknown,
  path: string,
  resolutions: MergeResolution[],
): unknown {
  // Override is null/undefined → keep base
  if (override === null || override === undefined) {
    if (path) {
      resolutions.push({ path, source: 'base' });
    }
    return base;
  }

  // Base is null/undefined → take override
  if (base === null || base === undefined) {
    if (path) {
      resolutions.push({ path, source: 'override' });
    }
    return override;
  }

  // Both are objects (not arrays) → recursive merge
  if (isPlainObject(base) && isPlainObject(override)) {
    const baseObj = base as Record<string, unknown>;
    const overrideObj = override as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(overrideObj)]);

    if (path) {
      resolutions.push({ path, source: 'merged' });
    }

    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      if (key in overrideObj) {
        if (key in baseObj) {
          result[key] = deepMerge(baseObj[key], overrideObj[key], childPath, resolutions);
        } else {
          resolutions.push({ path: childPath, source: 'override' });
          result[key] = overrideObj[key];
        }
      } else {
        resolutions.push({ path: childPath, source: 'base' });
        result[key] = baseObj[key];
      }
    }

    return result;
  }

  // Arrays and scalars → override wins
  if (path) {
    resolutions.push({ path, source: 'override' });
  }
  return override;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Format merge result as a human-readable report.
 */
export function formatMergeReport(result: MergeResult): string {
  const lines: string[] = [];
  lines.push('Config Merge Report');
  lines.push('═'.repeat(50));
  lines.push('');

  // Group resolutions by source
  const baseOnly = result.resolutions.filter((r) => r.source === 'base');
  const overrides = result.resolutions.filter((r) => r.source === 'override');
  const merged = result.resolutions.filter((r) => r.source === 'merged');

  if (baseOnly.length > 0) {
    lines.push('  Base-only keys:');
    for (const r of baseOnly) {
      lines.push(`    ○ ${r.path}`);
    }
    lines.push('');
  }

  if (overrides.length > 0) {
    lines.push('  Overridden keys:');
    for (const r of overrides) {
      lines.push(`    ● ${r.path}`);
    }
    lines.push('');
  }

  if (merged.length > 0) {
    lines.push('  Recursively merged:');
    for (const r of merged) {
      lines.push(`    ⊕ ${r.path}`);
    }
    lines.push('');
  }

  lines.push(`Summary: ${result.baseOnlyCount} base-only, ${result.overrideCount} overridden, ${result.mergedCount} merged`);

  return lines.join('\n');
}
