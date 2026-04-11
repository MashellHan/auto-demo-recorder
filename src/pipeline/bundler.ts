import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { existsSync } from 'node:fs';

export interface BundleOptions {
  /** Path to the recording output directory (e.g., .demo-recordings/2026-04-11/basic). */
  recordingDir: string;
  /** Output path for the bundle zip or directory. */
  outputPath: string;
  /** Include the raw video in the bundle. */
  includeRaw?: boolean;
  /** Include extracted frames in the bundle. */
  includeFrames?: boolean;
}

export interface BundleManifest {
  /** Project name. */
  project: string;
  /** Scenario name. */
  scenario: string;
  /** Recording timestamp. */
  timestamp: string;
  /** Files included in the bundle. */
  files: BundleFile[];
  /** Total size in bytes. */
  totalSize: number;
}

export interface BundleFile {
  /** File name (relative to bundle root). */
  name: string;
  /** File size in bytes. */
  size: number;
  /** File type category. */
  type: 'video' | 'report' | 'player' | 'docs' | 'svg' | 'thumbnail' | 'frame' | 'other';
}

/**
 * Scan a recording directory and generate a bundle manifest listing all files.
 * Does not create a zip — just inventories what would be bundled.
 */
export async function createBundleManifest(options: BundleOptions): Promise<BundleManifest> {
  const { recordingDir, includeRaw = true, includeFrames = false } = options;

  if (!existsSync(recordingDir)) {
    throw new Error(`Recording directory not found: ${recordingDir}`);
  }

  const entries = await readdir(recordingDir, { withFileTypes: true });
  const files: BundleFile[] = [];
  let totalSize = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === 'frames' && includeFrames) {
        const framesDir = join(recordingDir, 'frames');
        const frameFiles = await readdir(framesDir);
        for (const ff of frameFiles) {
          const fstat = await stat(join(framesDir, ff));
          const file: BundleFile = {
            name: `frames/${ff}`,
            size: fstat.size,
            type: 'frame',
          };
          files.push(file);
          totalSize += fstat.size;
        }
      }
      continue;
    }

    const name = entry.name;
    const ext = extname(name).toLowerCase();

    // Skip raw video if not included
    if (!includeRaw && name.startsWith('raw.')) continue;

    const fstat = await stat(join(recordingDir, name));
    const type = classifyFile(name, ext);
    files.push({ name, size: fstat.size, type });
    totalSize += fstat.size;
  }

  // Try to read project/scenario from report
  let project = 'unknown';
  let scenario = 'unknown';
  let timestamp = '';

  const reportPath = join(recordingDir, 'report.json');
  if (existsSync(reportPath)) {
    try {
      const reportContent = await readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);
      project = report.project ?? 'unknown';
      scenario = report.scenario ?? 'unknown';
      timestamp = report.timestamp ?? '';
    } catch {
      // Use defaults
    }
  }

  return { project, scenario, timestamp, files, totalSize };
}

/**
 * Write a bundle manifest as a JSON file.
 */
export async function writeBundleManifest(manifest: BundleManifest, outputPath: string): Promise<void> {
  await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Format a bundle manifest as a human-readable summary.
 */
export function formatManifestSummary(manifest: BundleManifest): string {
  const lines: string[] = [];
  lines.push(`Bundle: ${manifest.project} — ${manifest.scenario}`);
  if (manifest.timestamp) {
    lines.push(`Recorded: ${manifest.timestamp}`);
  }
  lines.push(`Files: ${manifest.files.length}`);
  lines.push(`Total size: ${formatSize(manifest.totalSize)}`);
  lines.push('');
  lines.push('Contents:');

  const byType = new Map<string, BundleFile[]>();
  for (const file of manifest.files) {
    const existing = byType.get(file.type) ?? [];
    existing.push(file);
    byType.set(file.type, existing);
  }

  for (const [type, files] of byType) {
    const typeSize = files.reduce((sum, f) => sum + f.size, 0);
    lines.push(`  ${type} (${files.length} file${files.length > 1 ? 's' : ''}, ${formatSize(typeSize)}):`);
    for (const file of files) {
      lines.push(`    ${file.name} (${formatSize(file.size)})`);
    }
  }

  return lines.join('\n');
}

function classifyFile(name: string, ext: string): BundleFile['type'] {
  if (ext === '.mp4' || ext === '.webm' || ext === '.gif') return 'video';
  if (name === 'report.json') return 'report';
  if (name === 'player.html') return 'player';
  if (name === 'DEMO.md') return 'docs';
  if (ext === '.svg') return 'svg';
  if (ext === '.png' && name.startsWith('thumbnail')) return 'thumbnail';
  if (ext === '.png') return 'frame';
  return 'other';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
