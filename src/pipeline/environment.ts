import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const execFile = promisify(execFileCb);

/** Environment snapshot capturing system, tool, and project information. */
export interface EnvironmentSnapshot {
  timestamp: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    npmVersion: string | null;
  };
  tools: {
    vhsVersion: string | null;
    ffmpegVersion: string | null;
    playwrightVersion: string | null;
  };
  project: {
    name: string;
    directory: string;
    packageManager: string | null;
    dependencies: Record<string, string>;
  };
}

/**
 * Capture an environment snapshot with system info, tool versions,
 * and project dependencies.
 */
export async function captureEnvironmentSnapshot(
  projectDir: string,
  projectName: string,
): Promise<EnvironmentSnapshot> {
  const [
    npmVersion,
    vhsVersion,
    ffmpegVersion,
    playwrightVersion,
    packageManager,
    dependencies,
  ] = await Promise.all([
    getCommandVersion('npm', ['--version']),
    getCommandVersion('vhs', ['--version']),
    getFFmpegVersion(),
    getPlaywrightVersion(projectDir),
    detectPackageManager(projectDir),
    readProjectDependencies(projectDir),
  ]);

  return {
    timestamp: new Date().toISOString(),
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      npmVersion,
    },
    tools: {
      vhsVersion,
      ffmpegVersion,
      playwrightVersion,
    },
    project: {
      name: projectName,
      directory: projectDir,
      packageManager,
      dependencies,
    },
  };
}

/**
 * Format an environment snapshot as a human-readable report.
 */
export function formatEnvironmentSnapshot(snapshot: EnvironmentSnapshot): string {
  const lines: string[] = [];

  lines.push('Environment Snapshot');
  lines.push('═'.repeat(40));
  lines.push(`Captured: ${snapshot.timestamp}`);
  lines.push('');

  lines.push('System:');
  lines.push(`  Platform: ${snapshot.system.platform}`);
  lines.push(`  Arch: ${snapshot.system.arch}`);
  lines.push(`  Node.js: ${snapshot.system.nodeVersion}`);
  lines.push(`  npm: ${snapshot.system.npmVersion ?? 'not found'}`);
  lines.push('');

  lines.push('Tools:');
  lines.push(`  VHS: ${snapshot.tools.vhsVersion ?? 'not installed'}`);
  lines.push(`  FFmpeg: ${snapshot.tools.ffmpegVersion ?? 'not installed'}`);
  lines.push(`  Playwright: ${snapshot.tools.playwrightVersion ?? 'not installed'}`);
  lines.push('');

  lines.push('Project:');
  lines.push(`  Name: ${snapshot.project.name}`);
  lines.push(`  Directory: ${snapshot.project.directory}`);
  lines.push(`  Package Manager: ${snapshot.project.packageManager ?? 'unknown'}`);

  const depCount = Object.keys(snapshot.project.dependencies).length;
  if (depCount > 0) {
    lines.push(`  Dependencies: ${depCount}`);
  }

  return lines.join('\n');
}

/** Get the output of a command's version flag. */
async function getCommandVersion(command: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFile(command, args, { timeout: 5000 });
    return stdout.trim().split('\n')[0] ?? null;
  } catch {
    return null;
  }
}

/** Get FFmpeg version (first line only). */
async function getFFmpegVersion(): Promise<string | null> {
  try {
    const { stderr } = await execFile('ffmpeg', ['-version'], { timeout: 5000 });
    // ffmpeg outputs version to stderr or stdout depending on version
    const output = stderr.trim() || '';
    const match = output.match(/ffmpeg version (\S+)/);
    return match ? match[1] : null;
  } catch {
    try {
      const { stdout } = await execFile('ffmpeg', ['-version'], { timeout: 5000 });
      const match = stdout.match(/ffmpeg version (\S+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}

/** Detect the Playwright version from node_modules. */
async function getPlaywrightVersion(projectDir: string): Promise<string | null> {
  try {
    const pkgPath = resolve(projectDir, 'node_modules', '@playwright', 'test', 'package.json');
    if (!existsSync(pkgPath)) {
      // Try playwright (non-test) package
      const altPath = resolve(projectDir, 'node_modules', 'playwright', 'package.json');
      if (!existsSync(altPath)) return null;
      const pkg = JSON.parse(await readFile(altPath, 'utf-8'));
      return pkg.version ?? null;
    }
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

/** Detect which package manager the project uses. */
async function detectPackageManager(projectDir: string): Promise<string | null> {
  if (existsSync(resolve(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(resolve(projectDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(resolve(projectDir, 'bun.lockb'))) return 'bun';
  if (existsSync(resolve(projectDir, 'package-lock.json'))) return 'npm';
  return null;
}

/** Read top-level dependencies from package.json. */
async function readProjectDependencies(projectDir: string): Promise<Record<string, string>> {
  try {
    const pkgPath = resolve(projectDir, 'package.json');
    if (!existsSync(pkgPath)) return {};
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  } catch {
    return {};
  }
}
