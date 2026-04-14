import { execFile } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface VhsRunResult {
  videoPath: string;
  durationMs: number;
}

export async function runVhs(tapePath: string, tapeContent: string): Promise<VhsRunResult> {
  await mkdir(dirname(tapePath), { recursive: true });
  await writeFile(tapePath, tapeContent, 'utf-8');

  const start = Date.now();

  await new Promise<void>((resolve, reject) => {
    const proc = execFile('vhs', [tapePath], { timeout: 60_000 }, (error) => {
      if (error) {
        reject(new Error(`VHS failed: ${error.message}`));
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

  // Extract output path from tape content
  const outputMatch = tapeContent.match(/^Output\s+"?([^"]+)"?$/m);
  if (!outputMatch) {
    throw new Error('Could not find Output directive in tape file');
  }

  return {
    videoPath: outputMatch[1],
    durationMs,
  };
}
