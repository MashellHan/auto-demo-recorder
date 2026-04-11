import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/** Visual diff result for a single frame pair. */
export interface FrameDiff {
  /** Frame index (1-based). */
  frameIndex: number;
  /** Description from session A. */
  descriptionA: string;
  /** Description from session B. */
  descriptionB: string;
  /** Whether the descriptions are meaningfully different. */
  changed: boolean;
  /** Bug status changed. */
  bugStatusChanged: boolean;
}

/** Complete visual diff result between two recording sessions. */
export interface VisualDiffResult {
  scenarioName: string;
  sessionA: string;
  sessionB: string;
  frameDiffs: FrameDiff[];
  totalFrames: number;
  changedFrames: number;
  changePercent: number;
}

/** Minimal frame structure from a recording report. */
interface ReportFrame {
  frame_number: number;
  description: string;
  bugs_detected?: boolean;
  feature_being_demonstrated?: string;
  status?: string;
}

/** Minimal report structure for visual diff. */
interface ReportData {
  scenario: string;
  frames: ReportFrame[];
}

/**
 * Compare frame descriptions between two recording sessions to detect visual changes.
 */
export async function visualDiff(
  outputDir: string,
  sessionA: string,
  sessionB: string,
  scenarioName: string,
): Promise<VisualDiffResult> {
  const reportAPath = join(outputDir, sessionA, scenarioName, 'report.json');
  const reportBPath = join(outputDir, sessionB, scenarioName, 'report.json');

  if (!existsSync(reportAPath)) {
    throw new Error(`Report not found for session A: ${reportAPath}`);
  }
  if (!existsSync(reportBPath)) {
    throw new Error(`Report not found for session B: ${reportBPath}`);
  }

  const reportA: ReportData = JSON.parse(await readFile(reportAPath, 'utf-8'));
  const reportB: ReportData = JSON.parse(await readFile(reportBPath, 'utf-8'));

  return compareFrameDescriptions(reportA, reportB, sessionA, sessionB);
}

/**
 * Compare frame descriptions between two reports.
 */
export function compareFrameDescriptions(
  reportA: ReportData,
  reportB: ReportData,
  sessionA: string,
  sessionB: string,
): VisualDiffResult {
  const maxFrames = Math.max(reportA.frames.length, reportB.frames.length);
  const frameDiffs: FrameDiff[] = [];

  for (let i = 0; i < maxFrames; i++) {
    const frameA = reportA.frames[i];
    const frameB = reportB.frames[i];

    const descA = frameA?.description ?? '(no frame)';
    const descB = frameB?.description ?? '(no frame)';

    const bugA = frameA?.bugs_detected ?? false;
    const bugB = frameB?.bugs_detected ?? false;

    // Descriptions are "changed" if they differ significantly
    const changed = !areDescriptionsSimilar(descA, descB);
    const bugStatusChanged = bugA !== bugB;

    frameDiffs.push({
      frameIndex: i + 1,
      descriptionA: descA,
      descriptionB: descB,
      changed,
      bugStatusChanged,
    });
  }

  const changedFrames = frameDiffs.filter((f) => f.changed || f.bugStatusChanged).length;

  return {
    scenarioName: reportA.scenario ?? reportB.scenario ?? 'unknown',
    sessionA,
    sessionB,
    frameDiffs,
    totalFrames: maxFrames,
    changedFrames,
    changePercent: maxFrames > 0 ? parseFloat(((changedFrames / maxFrames) * 100).toFixed(1)) : 0,
  };
}

/**
 * Check if two descriptions are similar enough to be considered the same.
 * Uses word overlap as a simple similarity metric.
 */
function areDescriptionsSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === '(no frame)' || b === '(no frame)') return false;

  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);

  // Jaccard similarity > 0.5 means similar enough
  return intersection.length / union.size > 0.5;
}

/**
 * Format a visual diff result as a human-readable string.
 */
export function formatVisualDiff(result: VisualDiffResult): string {
  const lines: string[] = [];

  lines.push(`Visual Diff: ${result.scenarioName}`);
  lines.push('─'.repeat(50));
  lines.push(`Session A: ${result.sessionA}`);
  lines.push(`Session B: ${result.sessionB}`);
  lines.push(`Changed: ${result.changedFrames}/${result.totalFrames} frames (${result.changePercent}%)`);
  lines.push('');

  if (result.changedFrames === 0) {
    lines.push('  ✓ No visual changes detected.');
  } else {
    for (const diff of result.frameDiffs) {
      if (!diff.changed && !diff.bugStatusChanged) continue;

      const icon = diff.bugStatusChanged ? '✗' : '⚠';
      lines.push(`  ${icon} Frame ${diff.frameIndex}:`);
      lines.push(`    A: ${diff.descriptionA}`);
      lines.push(`    B: ${diff.descriptionB}`);
      if (diff.bugStatusChanged) {
        lines.push(`    [Bug status changed]`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
