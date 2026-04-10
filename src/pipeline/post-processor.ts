import { execFile } from 'node:child_process';
import type { FrameAnalysis } from './annotator.js';

export interface PostProcessOptions {
  inputVideo: string;
  outputVideo: string;
  thumbnailPath: string;
  frames: FrameAnalysis[];
  overlayFontSize: number;
  overlayPosition: 'top' | 'bottom';
}

export async function postProcess(options: PostProcessOptions): Promise<void> {
  const { inputVideo, outputVideo, thumbnailPath, frames, overlayFontSize, overlayPosition } =
    options;

  // Build drawtext filter chain from frame annotations
  const drawFilters = buildDrawTextFilters(frames, overlayFontSize, overlayPosition);
  const barFilter = buildBarFilter(overlayPosition);
  const vf = [barFilter, ...drawFilters].join(',');

  // Overlay annotations
  await runFfmpeg(['-i', inputVideo, '-vf', vf, '-codec:a', 'copy', '-y', outputVideo]);

  // Generate thumbnail from first frame
  await runFfmpeg(['-i', outputVideo, '-vframes', '1', '-y', thumbnailPath]);
}

function buildBarFilter(position: 'top' | 'bottom'): string {
  const y = position === 'bottom' ? 'ih-50' : '0';
  return `drawbox=x=0:y=${y}:w=iw:h=50:color=black@0.7:t=fill`;
}

function buildDrawTextFilters(
  frames: FrameAnalysis[],
  fontSize: number,
  position: 'top' | 'bottom',
): string[] {
  const filters: string[] = [];
  const y = position === 'bottom' ? 'h-35' : '15';

  // Group consecutive frames with the same annotation
  const groups = groupFramesByAnnotation(frames);

  for (const group of groups) {
    const text = escapeFfmpegText(group.text);
    if (!text) continue;

    const startTime = group.startIndex;
    const endTime = group.endIndex + 1;

    filters.push(
      `drawtext=text='${text}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}:enable='between(t\\,${startTime}\\,${endTime})'`,
    );
  }

  return filters;
}

interface FrameGroup {
  text: string;
  startIndex: number;
  endIndex: number;
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
