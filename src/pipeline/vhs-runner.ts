import { execFile } from 'node:child_process';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface VhsRunResult {
  videoPath: string;
  durationMs: number;
}

export async function runVhs(tapePath: string, tapeContent: string): Promise<VhsRunResult> {
  await mkdir(dirname(tapePath), { recursive: true });
  await writeFile(tapePath, tapeContent, 'utf-8');

  // Extract output path from tape content (needed for post-failure check)
  const outputMatch = tapeContent.match(/^Output\s+"?([^"]+)"?$/m);
  if (!outputMatch) {
    throw new Error('Could not find Output directive in tape file');
  }
  const videoPath = outputMatch[1];

  const start = Date.now();

  let vhsError: Error | undefined;
  await new Promise<void>((resolve, reject) => {
    const proc = execFile('vhs', [tapePath], { timeout: 60_000 }, (error) => {
      if (error) {
        vhsError = error;
        resolve(); // Don't reject yet — check output file first
      } else {
        resolve();
      }
    });
    proc.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.error(`  [vhs] ${line}`);
    });
  });

  const durationMs = Date.now() - start;

  // If VHS errored, check whether the output file was created despite the error
  if (vhsError) {
    const fileExists = await stat(videoPath)
      .then((s) => s.size > 0)
      .catch(() => false);

    if (fileExists) {
      console.warn(
        `VHS exited with error but output file exists (${videoPath}). Treating as success.`,
      );
    } else {
      throw new Error(`VHS failed: ${vhsError.message}`);
    }
  }

  return {
    videoPath,
    durationMs,
  };
}
