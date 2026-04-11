import { readdir, stat, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

/** Artifacts discovered in a session directory. */
export interface SessionArtifacts {
  /** Subdirectories (scenario folders). */
  directories: string[];
  /** Top-level files (session-report.json, etc.). */
  files: string[];
}

/** Result of creating an archive. */
export interface ArchiveResult {
  /** Absolute path to the created archive file. */
  outputPath: string;
  /** Format used (tar or zip). */
  format: 'tar' | 'zip';
  /** Session directory that was archived. */
  sessionDir: string;
}

/**
 * List artifacts in a recording session directory.
 */
export async function listSessionArtifacts(sessionDir: string): Promise<SessionArtifacts> {
  const entries = await readdir(sessionDir);
  const directories: string[] = [];
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(sessionDir, entry);
    const s = await stat(entryPath);
    if (s.isDirectory()) {
      directories.push(entry);
    } else if (s.isFile()) {
      files.push(entry);
    }
  }

  return { directories, files };
}

/**
 * Create an archive of a recording session directory.
 *
 * @param sessionDir - Absolute path to the session directory to archive.
 * @param outputDir - Directory where the archive file will be created.
 * @param format - Archive format: 'tar' (creates .tar.gz) or 'zip'.
 * @returns Result with the path to the created archive.
 */
export async function createArchive(
  sessionDir: string,
  outputDir: string,
  format: 'tar' | 'zip' = 'tar',
): Promise<ArchiveResult> {
  const sessionName = basename(sessionDir);

  if (format === 'zip') {
    const archivePath = join(outputDir, `${sessionName}.zip`);
    await execFile('zip', ['-r', archivePath, '.'], { cwd: sessionDir });
    return { outputPath: archivePath, format: 'zip', sessionDir };
  }

  // Default: tar.gz
  const archivePath = join(outputDir, `${sessionName}.tar.gz`);
  await execFile('tar', ['-czf', archivePath, '-C', sessionDir, '.']);
  return { outputPath: archivePath, format: 'tar', sessionDir };
}
