import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

/** Result of resolving config extends chain. */
export interface ExtendsResolution {
  /** Ordered list of config file paths in the chain (base first). */
  chain: string[];
  /** Errors found during resolution (missing files, circular refs). */
  errors: string[];
  /** Whether the chain is valid (no errors). */
  valid: boolean;
}

/**
 * Resolve a config extends chain.
 * Follows `extends` fields from the starting config until the chain ends.
 * Detects circular references and missing files.
 */
export async function resolveExtendsChain(configPath: string): Promise<ExtendsResolution> {
  const chain: string[] = [];
  const errors: string[] = [];
  const visited = new Set<string>();

  let currentPath = resolve(configPath);

  while (currentPath) {
    // Detect circular reference
    if (visited.has(currentPath)) {
      errors.push(`Circular extends detected: ${currentPath} already in chain [${chain.join(' → ')}]`);
      break;
    }

    if (!existsSync(currentPath)) {
      errors.push(`Config file not found: ${currentPath}`);
      break;
    }

    visited.add(currentPath);
    chain.push(currentPath);

    try {
      const yaml = await import('yaml');
      const content = await readFile(currentPath, 'utf-8');
      const config = yaml.parse(content);

      if (!config || typeof config.extends !== 'string') {
        break; // No more extends
      }

      // Resolve relative path from current config's directory
      const baseDir = dirname(currentPath);
      currentPath = resolve(baseDir, config.extends);
    } catch (err) {
      errors.push(`Failed to parse ${currentPath}: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  return {
    chain: chain.reverse(), // Base first, most specific last
    errors,
    valid: errors.length === 0,
  };
}

/**
 * Validate extends references in a config file.
 * Returns error messages for any issues found.
 */
export async function validateExtends(configPath: string): Promise<string[]> {
  const result = await resolveExtendsChain(configPath);
  return result.errors;
}

/**
 * Format an extends resolution as a human-readable string.
 */
export function formatExtendsChain(resolution: ExtendsResolution): string {
  const lines: string[] = [];

  lines.push('Config Extends Chain:');
  lines.push('─'.repeat(40));

  if (resolution.chain.length <= 1) {
    lines.push('  No extends chain (standalone config).');
  } else {
    for (let i = 0; i < resolution.chain.length; i++) {
      const prefix = i === resolution.chain.length - 1 ? '└─' : '├─';
      lines.push(`  ${prefix} ${resolution.chain[i]}`);
    }
  }

  if (resolution.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const err of resolution.errors) {
      lines.push(`  ✗ ${err}`);
    }
  } else {
    lines.push('');
    lines.push('  ✓ Chain is valid');
  }

  return lines.join('\n');
}
