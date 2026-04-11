import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, type Config } from './schema.js';

const DEFAULT_CONFIG_NAME = 'demo-recorder.yaml';

/**
 * Load and validate a demo-recorder.yaml config file.
 * @param configPath - Absolute path to the config file. Defaults to `demo-recorder.yaml` in the current directory.
 * @returns Parsed and Zod-validated configuration object.
 * @throws If the file cannot be read or fails schema validation.
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  const filePath = configPath ?? resolve(process.cwd(), DEFAULT_CONFIG_NAME);

  const raw = await readFile(filePath, 'utf-8');
  const parsed = parseYaml(raw);
  return ConfigSchema.parse(parsed);
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
