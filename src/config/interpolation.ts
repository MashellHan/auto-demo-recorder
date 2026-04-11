/**
 * Config variable interpolation — substitute ${VAR} placeholders
 * in config values with environment variables.
 *
 * Supports:
 * - ${VAR} — required, throws if missing
 * - ${VAR:-default} — with default value
 *
 * Only interpolates string values; numbers, booleans, arrays, and
 * nested objects are recursively traversed but non-string leaves
 * are left untouched.
 */

/** Pattern for ${VAR} and ${VAR:-default} */
const VAR_PATTERN = /\$\{([^}:]+?)(?::-(.*?))?\}/g;

/** Result of interpolation. */
export interface InterpolationResult {
  /** The interpolated config object. */
  readonly config: Record<string, unknown>;
  /** Variables that were resolved. */
  readonly resolved: readonly string[];
  /** Variables using default values. */
  readonly defaults: readonly string[];
  /** Variables that were missing (if strict mode is off). */
  readonly missing: readonly string[];
}

/**
 * Interpolate environment variables in a config object.
 *
 * @param config - Raw parsed config (pre-validation).
 * @param env - Environment variable source (defaults to process.env).
 * @param strict - If true, throw on missing variables with no default.
 */
export function interpolateConfig(
  config: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
  strict: boolean = true,
): InterpolationResult {
  const resolved: string[] = [];
  const defaults: string[] = [];
  const missing: string[] = [];

  function interpolateValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(VAR_PATTERN, (_match, varName: string, defaultValue?: string) => {
        const envValue = env[varName];

        if (envValue !== undefined) {
          resolved.push(varName);
          return envValue;
        }

        if (defaultValue !== undefined) {
          defaults.push(varName);
          return defaultValue;
        }

        if (strict) {
          throw new Error(`Missing environment variable: ${varName}`);
        }

        missing.push(varName);
        return _match; // Leave the placeholder intact
      });
    }

    if (Array.isArray(value)) {
      return value.map(interpolateValue);
    }

    if (value !== null && typeof value === 'object') {
      return interpolateObject(value as Record<string, unknown>);
    }

    return value;
  }

  function interpolateObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = interpolateValue(val);
    }
    return result;
  }

  const interpolated = interpolateObject(config);

  return {
    config: interpolated,
    resolved: [...new Set(resolved)],
    defaults: [...new Set(defaults)],
    missing: [...new Set(missing)],
  };
}

/**
 * List all variable references in a config object.
 */
export function listConfigVariables(config: Record<string, unknown>): readonly string[] {
  const vars = new Set<string>();

  function scan(value: unknown): void {
    if (typeof value === 'string') {
      let match: RegExpExecArray | null;
      const regex = /\$\{([^}:]+?)(?::-(.*?))?\}/g;
      while ((match = regex.exec(value)) !== null) {
        vars.add(match[1]);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) scan(item);
    } else if (value !== null && typeof value === 'object') {
      for (const val of Object.values(value as Record<string, unknown>)) {
        scan(val);
      }
    }
  }

  scan(config);
  return [...vars].sort();
}

/**
 * Format interpolation result.
 */
export function formatInterpolationResult(result: InterpolationResult): string {
  const lines: string[] = [];
  lines.push('Config Variable Interpolation');
  lines.push('═'.repeat(50));
  lines.push('');

  if (result.resolved.length === 0 && result.defaults.length === 0 && result.missing.length === 0) {
    lines.push('  No variables found in config.');
    return lines.join('\n');
  }

  if (result.resolved.length > 0) {
    lines.push('  Resolved from environment:');
    for (const v of result.resolved) lines.push(`    ✓ ${v}`);
    lines.push('');
  }

  if (result.defaults.length > 0) {
    lines.push('  Using defaults:');
    for (const v of result.defaults) lines.push(`    ⚬ ${v}`);
    lines.push('');
  }

  if (result.missing.length > 0) {
    lines.push('  Missing (unresolved):');
    for (const v of result.missing) lines.push(`    ✗ ${v}`);
    lines.push('');
  }

  const total = result.resolved.length + result.defaults.length + result.missing.length;
  lines.push(`  Total: ${total} variables (${result.resolved.length} resolved, ${result.defaults.length} defaults, ${result.missing.length} missing)`);
  return lines.join('\n');
}
