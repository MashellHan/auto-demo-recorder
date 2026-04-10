import { mkdir, writeFile, symlink, unlink, rm } from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Config, Scenario } from './config/schema.js';
import { buildTape } from './pipeline/tape-builder.js';
import { runVhs } from './pipeline/vhs-runner.js';
import { extractFrames } from './pipeline/frame-extractor.js';
import { annotateFrames } from './pipeline/annotator.js';
import { postProcess } from './pipeline/post-processor.js';

export { loadConfig, findScenario } from './config/loader.js';
export { ConfigSchema } from './config/schema.js';
export type { Config, Scenario } from './config/schema.js';

export interface RecordResult {
  success: boolean;
  videoPath: string;
  rawVideoPath: string;
  reportPath: string;
  thumbnailPath: string;
  summary: {
    status: string;
    durationSeconds: number;
    framesAnalyzed: number;
    bugsFound: number;
    featuresDemo: string[];
    description: string;
  };
}

export interface RecordOptions {
  config: Config;
  scenario: Scenario;
  projectDir: string;
}

export async function record(options: RecordOptions): Promise<RecordResult> {
  const { config, scenario, projectDir } = options;

  const timestamp = formatTimestamp(new Date());
  const outputBase = resolve(projectDir, config.output.dir, timestamp, scenario.name);
  await mkdir(outputBase, { recursive: true });

  const rawVideoPath = join(outputBase, 'raw.mp4');
  const annotatedVideoPath = join(outputBase, 'annotated.mp4');
  const thumbnailPath = join(outputBase, 'thumbnail.png');
  const reportPath = join(outputBase, 'report.json');
  const framesDir = join(outputBase, 'frames');
  const tapePath = join(outputBase, `${scenario.name}.tape`);

  // 1. Build tape
  console.log(`Recording scenario: ${scenario.name}`);
  const tapeContent = buildTape({
    scenario,
    recording: config.recording,
    outputPath: rawVideoPath,
  });
  console.log('  \u2713 Tape generated');

  // 2. Build project if needed
  if (config.project.build_command) {
    console.log(`  Building: ${config.project.build_command}`);
    const execFileAsync = promisify(execFileCb);
    const [cmd, ...args] = config.project.build_command.split(/\s+/);
    await execFileAsync(cmd, args, { cwd: projectDir });
    console.log('  \u2713 Build complete');
  }

  // 3. Run VHS
  const vhsResult = await runVhs(tapePath, tapeContent);
  const durationSeconds = vhsResult.durationMs / 1000;
  console.log(`  \u2713 VHS recording complete (${durationSeconds.toFixed(1)}s)`);

  // 4. Extract frames (if annotation enabled)
  let annotationResult = null;
  if (config.annotation.enabled) {
    const extraction = await extractFrames(rawVideoPath, framesDir, config.annotation.extract_fps);
    console.log(`  \u2713 Frames extracted (${extraction.frameCount} frames)`);

    // 5. AI annotation
    annotationResult = await annotateFrames(
      framesDir,
      extraction.frameCount,
      config.project.name,
      config.project.description,
      scenario.description,
      config.annotation,
    );
    console.log('  \u2713 AI annotation complete');

    // 6. Post-process
    await postProcess({
      inputVideo: rawVideoPath,
      outputVideo: annotatedVideoPath,
      thumbnailPath,
      frames: annotationResult.frames,
      overlayFontSize: config.annotation.overlay_font_size,
      overlayPosition: config.annotation.overlay_position,
      extractFps: config.annotation.extract_fps,
    });
    console.log('  \u2713 Video annotated');

    // Cleanup frames if not keeping
    if (!config.output.keep_frames) {
      await rm(framesDir, { recursive: true, force: true });
    }
  }

  // 7. Write report
  const report = {
    project: config.project.name,
    scenario: scenario.name,
    timestamp: new Date().toISOString(),
    duration_seconds: durationSeconds,
    total_frames_analyzed: annotationResult?.frames.length ?? 0,
    overall_status: annotationResult?.overall_status ?? 'ok',
    frames: annotationResult?.frames ?? [],
    summary: annotationResult?.summary ?? 'Recording complete (no annotation).',
    bugs_found: annotationResult?.bugs_found ?? 0,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  // 8. Update latest symlink
  const latestLink = resolve(projectDir, config.output.dir, 'latest');
  try {
    await unlink(latestLink);
  } catch {
    // symlink may not exist
  }
  const timestampDir = resolve(projectDir, config.output.dir, timestamp);
  await symlink(timestampDir, latestLink);

  const featuresDemo = annotationResult
    ? [...new Set(annotationResult.frames.map((f) => f.feature_being_demonstrated).filter(Boolean))]
    : [];

  const finalVideoPath = config.annotation.enabled ? annotatedVideoPath : rawVideoPath;

  const result: RecordResult = {
    success: true,
    videoPath: finalVideoPath,
    rawVideoPath,
    reportPath,
    thumbnailPath,
    summary: {
      status: annotationResult?.overall_status ?? 'ok',
      durationSeconds,
      framesAnalyzed: annotationResult?.frames.length ?? 0,
      bugsFound: annotationResult?.bugs_found ?? 0,
      featuresDemo,
      description: annotationResult?.summary ?? 'Recording complete.',
    },
  };

  // Print summary
  console.log('');
  console.log('Result:');
  console.log(`  Video:     ${result.videoPath}`);
  console.log(`  Report:    ${result.reportPath}`);
  console.log(`  Thumbnail: ${result.thumbnailPath}`);
  console.log('');
  console.log(`Summary: ${result.summary.description}`);

  return result;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}
