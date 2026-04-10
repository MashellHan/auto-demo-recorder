import { execFile } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';

export interface ExtractFramesResult {
  framesDir: string;
  frameCount: number;
}

export async function extractFrames(
  videoPath: string,
  outputDir: string,
  fps: number = 1,
): Promise<ExtractFramesResult> {
  await mkdir(outputDir, { recursive: true });

  const pattern = `${outputDir}/frame-%03d.png`;

  await new Promise<void>((resolve, reject) => {
    execFile(
      'ffmpeg',
      ['-i', videoPath, '-vf', `fps=${fps}`, pattern, '-y'],
      { timeout: 60_000 },
      (error) => {
        if (error) {
          reject(new Error(`ffmpeg frame extraction failed: ${error.message}`));
        } else {
          resolve();
        }
      },
    );
  });

  // Count extracted frames
  const files = await readdir(outputDir);
  const frameCount = files.filter((f) => f.startsWith('frame-') && f.endsWith('.png')).length;

  return { framesDir: outputDir, frameCount };
}
