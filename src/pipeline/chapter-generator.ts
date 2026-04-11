import type { ReportFrame } from './regression.js';

/** A chapter segment derived from recording frame analysis. */
export interface Chapter {
  /** Chapter title (derived from feature being demonstrated). */
  title: string;
  /** Start timestamp string (e.g., "0:00"). */
  startTime: string;
  /** Start time in seconds. */
  startSeconds: number;
  /** End timestamp string. */
  endTime: string;
  /** End time in seconds. */
  endSeconds: number;
  /** Number of frames in this chapter. */
  frameCount: number;
  /** Aggregated status for the chapter (worst frame status). */
  status: 'ok' | 'warning' | 'error';
  /** Description derived from the first frame's annotation. */
  description: string;
}

/** Table of contents generated from chapters. */
export interface TableOfContents {
  /** Project name. */
  projectName: string;
  /** Scenario name. */
  scenarioName: string;
  /** Total recording duration in seconds. */
  totalDuration: number;
  /** Ordered list of chapters. */
  chapters: Chapter[];
}

/**
 * Generate chapters from recording frames by grouping consecutive frames
 * that demonstrate the same feature. Transitions between features create
 * new chapter boundaries.
 */
export function generateChapters(frames: ReportFrame[]): Chapter[] {
  if (frames.length === 0) return [];

  const chapters: Chapter[] = [];
  let currentFeature = frames[0].feature_being_demonstrated || 'Introduction';
  let startFrame = frames[0];
  let chapterFrames: ReportFrame[] = [frames[0]];

  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    const feature = frame.feature_being_demonstrated || 'General';

    if (feature !== currentFeature) {
      // Feature transition → close current chapter and start new one
      chapters.push(buildChapter(currentFeature, startFrame, chapterFrames));
      currentFeature = feature;
      startFrame = frame;
      chapterFrames = [frame];
    } else {
      chapterFrames.push(frame);
    }
  }

  // Close the last chapter
  chapters.push(buildChapter(currentFeature, startFrame, chapterFrames));

  return chapters;
}

/**
 * Generate a table of contents from a recording report.
 */
export function generateTableOfContents(
  projectName: string,
  scenarioName: string,
  frames: ReportFrame[],
  totalDuration: number,
): TableOfContents {
  const chapters = generateChapters(frames);

  // Assign end times: each chapter ends when the next begins, last chapter ends at total duration
  for (let i = 0; i < chapters.length - 1; i++) {
    chapters[i].endTime = chapters[i + 1].startTime;
    chapters[i].endSeconds = chapters[i + 1].startSeconds;
  }
  if (chapters.length > 0) {
    const last = chapters[chapters.length - 1];
    last.endSeconds = totalDuration;
    last.endTime = formatTime(totalDuration);
  }

  return { projectName, scenarioName, totalDuration, chapters };
}

/**
 * Render table of contents as markdown.
 */
export function renderTocMarkdown(toc: TableOfContents): string {
  const lines: string[] = [];
  lines.push(`## Table of Contents\n`);
  lines.push(`**${toc.projectName}** — ${toc.scenarioName}\n`);

  for (let i = 0; i < toc.chapters.length; i++) {
    const ch = toc.chapters[i];
    const statusIcon = ch.status === 'ok' ? '✅' : ch.status === 'warning' ? '⚠️' : '❌';
    lines.push(`${i + 1}. **${ch.title}** (${ch.startTime} – ${ch.endTime}) ${statusIcon}`);
    if (ch.description) {
      lines.push(`   ${ch.description}`);
    }
  }

  lines.push('');
  lines.push(`*Total duration: ${formatTime(toc.totalDuration)}*`);
  return lines.join('\n');
}

/**
 * Render chapters as HTML for embedding in the player.
 */
export function renderChaptersHtml(chapters: Chapter[]): string {
  if (chapters.length === 0) return '';

  const items = chapters.map((ch, i) => {
    const statusClass = ch.status;
    return `    <div class="chapter" data-start="${ch.startSeconds}" data-end="${ch.endSeconds}">
      <span class="chapter-num">${i + 1}</span>
      <span class="chapter-title">${escapeHtml(ch.title)}</span>
      <span class="chapter-time">${escapeHtml(ch.startTime)}</span>
      <span class="chapter-status ${statusClass}">${ch.status}</span>
    </div>`;
  });

  return `<div class="chapters-list">\n${items.join('\n')}\n  </div>`;
}

function buildChapter(feature: string, startFrame: ReportFrame, frames: ReportFrame[]): Chapter {
  const worstStatus = getWorstStatus(frames);

  return {
    title: feature,
    startTime: startFrame.timestamp,
    startSeconds: parseTimestamp(startFrame.timestamp),
    endTime: startFrame.timestamp, // Will be updated by generateTableOfContents
    endSeconds: parseTimestamp(startFrame.timestamp),
    frameCount: frames.length,
    status: worstStatus,
    description: startFrame.annotation_text || startFrame.description || '',
  };
}

function getWorstStatus(frames: ReportFrame[]): 'ok' | 'warning' | 'error' {
  const statusPriority: Record<string, number> = { ok: 0, warning: 1, error: 2 };
  let worst = 'ok';
  for (const frame of frames) {
    if ((statusPriority[frame.status] ?? 0) > (statusPriority[worst] ?? 0)) {
      worst = frame.status;
    }
  }
  return worst as 'ok' | 'warning' | 'error';
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':');
  const minutes = parseInt(parts[0], 10) || 0;
  const seconds = parseInt(parts[1], 10) || 0;
  return minutes * 60 + seconds;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
