import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, type Config } from './schema.js';

const DEFAULT_CONFIG_NAME = 'demo-recorder.yaml';

export async function loadConfig(configPath?: string): Promise<Config> {
  const filePath = configPath ?? resolve(process.cwd(), DEFAULT_CONFIG_NAME);

  const raw = await readFile(filePath, 'utf-8');
  const parsed = parseYaml(raw);
  return ConfigSchema.parse(parsed);
}

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
