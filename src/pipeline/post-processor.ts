import { execFile } from 'node:child_process';
import type { FrameAnalysis } from './annotator.js';

export interface PostProcessOptions {
  inputVideo: string;
  outputVideo: string;
  thumbnailPath: string;
  frames: FrameAnalysis[];
  overlayFontSize: number;
  overlayPosition: 'top' | 'bottom';
  extractFps: number;
}

export async function postProcess(options: PostProcessOptions): Promise<void> {
  const { inputVideo, outputVideo, thumbnailPath, frames, overlayFontSize, overlayPosition, extractFps } =
    options;

  const hasDrawtext = await checkDrawtextSupport();

  // Build filter chain
  const filters: string[] = [buildBarFilter(overlayPosition)];

  if (hasDrawtext) {
    filters.push(...buildDrawTextFilters(frames, overlayFontSize, overlayPosition, extractFps));
    filters.push(...buildStatusDotFilters(frames, extractFps));
  }

  filters.push(...buildBugBorderFilters(frames, extractFps));
  const vf = filters.join(',');

  // Overlay annotations
  await runFfmpeg(['-i', inputVideo, '-vf', vf, '-codec:a', 'copy', '-y', outputVideo]);

  // Generate thumbnail from first frame
  await runFfmpeg(['-i', outputVideo, '-vframes', '1', '-y', thumbnailPath]);
}

let _drawtextSupported: boolean | null = null;

async function checkDrawtextSupport(): Promise<boolean> {
  if (_drawtextSupported !== null) return _drawtextSupported;
  try {
    const output = await new Promise<string>((resolve, reject) => {
      execFile('ffmpeg', ['-filters'], { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout + stderr);
      });
    });
    _drawtextSupported = output.includes('drawtext');
  } catch {
    _drawtextSupported = false;
  }
  return _drawtextSupported;
}

/** Reset cached drawtext support check (for testing) */
export function resetDrawtextCache(): void {
  _drawtextSupported = null;
}

function buildBarFilter(position: 'top' | 'bottom'): string {
  const y = position === 'bottom' ? 'ih-50' : '0';
  return `drawbox=x=0:y=${y}:w=iw:h=50:color=black@0.7:t=fill`;
}

function buildDrawTextFilters(
  frames: FrameAnalysis[],
  fontSize: number,
  position: 'top' | 'bottom',
  extractFps: number,
): string[] {
  const filters: string[] = [];
  const y = position === 'bottom' ? 'h-35' : '15';

  // Group consecutive frames with the same annotation
  const groups = groupFramesByAnnotation(frames);

  for (const group of groups) {
    const text = escapeFfmpegText(group.text);
    if (!text) continue;

    const startTime = group.startIndex / extractFps;
    const endTime = (group.endIndex + 1) / extractFps;

    const fadeDuration = 0.3;
    const fadeAlpha = `alpha='if(lt(t-${startTime}\\,${fadeDuration})\\,(t-${startTime})/${fadeDuration}\\,if(lt(${endTime}-t\\,${fadeDuration})\\,(${endTime}-t)/${fadeDuration}\\,1))'`;

    filters.push(
      `drawtext=text='${text}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}:${fadeAlpha}:enable='between(t\\,${startTime}\\,${endTime})'`,
    );
  }

  return filters;
}

interface FrameGroup {
  text: string;
  startIndex: number;
  endIndex: number;
}

function statusColor(status: string): string {
  switch (status) {
    case 'error': return 'red';
    case 'warning': return 'yellow';
    default: return 'green';
  }
}

function buildStatusDotFilters(frames: FrameAnalysis[], extractFps: number): string[] {
  const filters: string[] = [];
  const groups = groupFramesByStatus(frames);

  for (const group of groups) {
    const startTime = group.startIndex / extractFps;
    const endTime = (group.endIndex + 1) / extractFps;
    const color = statusColor(group.status);

    filters.push(
      `drawtext=text='\u25cf':fontcolor=${color}:fontsize=24:x=w-30:y=10:enable='between(t\\,${startTime}\\,${endTime})'`,
    );
  }

  return filters;
}

function buildBugBorderFilters(frames: FrameAnalysis[], extractFps: number): string[] {
  const filters: string[] = [];

  for (const frame of frames) {
    if (frame.status !== 'error' && frame.bugs_detected.length === 0) continue;

    const startTime = frame.index / extractFps;
    const endTime = (frame.index + 1) / extractFps;

    filters.push(
      `drawbox=x=0:y=0:w=iw:h=ih:color=red@0.5:t=4:enable='between(t\\,${startTime}\\,${endTime})'`,
    );
  }

  return filters;
}

interface StatusGroup {
  status: string;
  startIndex: number;
  endIndex: number;
}

function groupFramesByStatus(frames: FrameAnalysis[]): StatusGroup[] {
  const groups: StatusGroup[] = [];
  let current: StatusGroup | null = null;

  for (const frame of frames) {
    if (current && current.status === frame.status) {
      current.endIndex = frame.index;
    } else {
      if (current) groups.push(current);
      current = { status: frame.status, startIndex: frame.index, endIndex: frame.index };
    }
  }
  if (current) groups.push(current);

  return groups;
}

function groupFramesByAnnotation(frames: FrameAnalysis[]): FrameGroup[] {
  const groups: FrameGroup[] = [];
  let current: FrameGroup | null = null;

  for (const frame of frames) {
    const text = frame.annotation_text;
    if (current && current.text === text) {
      current.endIndex = frame.index;
    } else {
      if (current) groups.push(current);
      current = { text, startIndex: frame.index, endIndex: frame.index };
    }
  }
  if (current) groups.push(current);

  return groups;
}

function escapeFfmpegText(text: string): string {
  return text.replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/%/g, '%%');
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 120_000 }, (error) => {
      if (error) {
        reject(new Error(`ffmpeg failed: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}
