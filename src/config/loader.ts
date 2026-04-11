import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, type Config } from './schema.js';

const DEFAULT_CONFIG_NAME = 'demo-recorder.yaml';

/**
 * Deep merge two plain objects. Arrays are replaced (not concatenated).
 * Child values override base values at every level.
 */
export function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];

    if (
      baseVal !== null && overrideVal !== null &&
      typeof baseVal === 'object' && typeof overrideVal === 'object' &&
      !Array.isArray(baseVal) && !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }

  return result as T;
}

/**
 * Load and validate a demo-recorder.yaml config file.
 * Supports an `extends` field that references a base config to inherit from.
 *
 * @param configPath - Absolute path to the config file. Defaults to `demo-recorder.yaml` in the current directory.
 * @returns Parsed and Zod-validated configuration object.
 * @throws If the file cannot be read, the base file is missing, or fails schema validation.
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  const filePath = configPath ?? resolve(process.cwd(), DEFAULT_CONFIG_NAME);
  const parsed = await loadYaml(filePath);

  if (parsed.extends) {
    const basePath = resolve(dirname(filePath), parsed.extends as string);
    const baseParsed = await loadYaml(basePath);

    // Remove extends from both before merging
    const { extends: _baseExtends, ...baseClean } = baseParsed;
    const { extends: _childExtends, ...childClean } = parsed;

    // If the base also extends, resolve recursively
    let resolvedBase = baseClean;
    if (_baseExtends) {
      const grandBasePath = resolve(dirname(basePath), _baseExtends as string);
      const grandBaseParsed = await loadYaml(grandBasePath);
      const { extends: _, ...grandBaseClean } = grandBaseParsed;
      resolvedBase = deepMerge(grandBaseClean as Record<string, unknown>, baseClean as Record<string, unknown>);
    }

    const merged = deepMerge(resolvedBase as Record<string, unknown>, childClean as Record<string, unknown>);
    return ConfigSchema.parse(merged);
  }

  return ConfigSchema.parse(parsed);
}

async function loadYaml(filePath: string): Promise<Record<string, unknown>> {
  const raw = await readFile(filePath, 'utf-8');
  return parseYaml(raw) as Record<string, unknown>;
}

/**
 * Find a scenario by name within a loaded config.
 * @param config - Validated configuration object.
 * @param name - Scenario name to search for.
 * @returns The matching scenario.
 * @throws If no scenario with the given name exists.
 */
export function findScenario(config: Config, name: string) {
  const scenario = config.scenarios.find((s) => s.name === name);
  if (!scenario) {
    const available = config.scenarios.map((s) => s.name).join(', ');
    throw new Error(
      `Scenario "${name}" not found. Available: ${available}`,
    );
  }
  return scenario;
}
