import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const execFile = promisify(execFileCb);

/** Status of a single health check item. */
export interface HealthCheckItem {
  name: string;
  status: 'ok' | 'warning' | 'error';
  version?: string;
  message: string;
}

/** Result of a full health check. */
export interface HealthCheckResult {
  items: HealthCheckItem[];
  allPassed: boolean;
  warnings: number;
  errors: number;
}

/**
 * Run a comprehensive health check verifying all required tools
 * and configuration for demo-recorder.
 */
export async function runHealthCheck(projectDir: string, backend: 'vhs' | 'browser' = 'vhs'): Promise<HealthCheckResult> {
  const items: HealthCheckItem[] = [];

  // Check Node.js
  items.push({
    name: 'Node.js',
    status: 'ok',
    version: process.version,
    message: `Node.js ${process.version} detected`,
  });

  // Check npm
  const npm = await checkCommand('npm', ['--version']);
  items.push(npm);

  // Backend-specific checks
  if (backend === 'vhs') {
    const vhs = await checkCommand('vhs', ['--version']);
    items.push(vhs);

    const ffmpeg = await checkFfmpeg();
    items.push(ffmpeg);
  } else {
    const pw = await checkPlaywright(projectDir);
    items.push(pw);
  }

  // Check config file
  const configPath = resolve(projectDir, 'demo-recorder.yaml');
  items.push({
    name: 'Config file',
    status: existsSync(configPath) ? 'ok' : 'warning',
    message: existsSync(configPath)
      ? `Found: ${configPath}`
      : 'demo-recorder.yaml not found (use "demo-recorder init" to create one)',
  });

  // Check output directory
  const outputDir = resolve(projectDir, '.demo-recordings');
  items.push({
    name: 'Output directory',
    status: existsSync(outputDir) ? 'ok' : 'ok',
    message: existsSync(outputDir)
      ? `Exists: ${outputDir}`
      : 'Will be created on first recording',
  });

  // Check ANTHROPIC_API_KEY for annotation
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  items.push({
    name: 'ANTHROPIC_API_KEY',
    status: hasApiKey ? 'ok' : 'warning',
    message: hasApiKey
      ? 'API key configured'
      : 'Not set — AI annotation will be unavailable (use --no-annotate to skip)',
  });

  const errors = items.filter((i) => i.status === 'error').length;
  const warnings = items.filter((i) => i.status === 'warning').length;

  return {
    items,
    allPassed: errors === 0,
    warnings,
    errors,
  };
}

/**
 * Format a health check result as a human-readable report.
 */
export function formatHealthCheck(result: HealthCheckResult): string {
  const lines: string[] = [];
  lines.push('Health Check');
  lines.push('═'.repeat(40));

  for (const item of result.items) {
    const icon = item.status === 'ok' ? '✓' : item.status === 'warning' ? '⚠' : '✗';
    lines.push(`  ${icon} ${item.name}: ${item.message}`);
  }

  lines.push('');
  if (result.errors > 0) {
    lines.push(`✗ ${result.errors} error(s) found — fix before recording`);
  } else if (result.warnings > 0) {
    lines.push(`⚠ ${result.warnings} warning(s) — recording may work with limitations`);
  } else {
    lines.push('✓ All checks passed — ready to record!');
  }

  return lines.join('\n');
}

/** Check if a command is available and get its version. */
async function checkCommand(command: string, args: string[]): Promise<HealthCheckItem> {
  try {
    const { stdout } = await execFile(command, args, { timeout: 5000 });
    const version = stdout.trim().split('\n')[0];
    return {
      name: command,
      status: 'ok',
      version,
      message: `${command} ${version} detected`,
    };
  } catch {
    return {
      name: command,
      status: 'error',
      message: `${command} not found — install it first`,
    };
  }
}

/** Check FFmpeg availability. */
async function checkFfmpeg(): Promise<HealthCheckItem> {
  try {
    const { stdout } = await execFile('ffmpeg', ['-version'], { timeout: 5000 });
    const match = stdout.match(/ffmpeg version (\S+)/);
    return {
      name: 'FFmpeg',
      status: 'ok',
      version: match?.[1],
      message: `FFmpeg ${match?.[1] ?? 'detected'}`,
    };
  } catch {
    return {
      name: 'FFmpeg',
      status: 'warning',
      message: 'FFmpeg not found — video post-processing will be limited',
    };
  }
}

/** Check Playwright availability from node_modules. */
async function checkPlaywright(projectDir: string): Promise<HealthCheckItem> {
  const paths = [
    resolve(projectDir, 'node_modules', 'playwright', 'package.json'),
    resolve(projectDir, 'node_modules', '@playwright', 'test', 'package.json'),
  ];

  for (const pkgPath of paths) {
    if (existsSync(pkgPath)) {
      try {
        const { readFile } = await import('node:fs/promises');
        const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
        return {
          name: 'Playwright',
          status: 'ok',
          version: pkg.version,
          message: `Playwright ${pkg.version} detected`,
        };
      } catch {
        // continue to next path
      }
    }
  }

  return {
    name: 'Playwright',
    status: 'error',
    message: 'Playwright not installed — run "npm install playwright"',
  };
}
