import { mkdir, writeFile, symlink, unlink, rm } from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
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

  const paths = {
    rawVideo: join(outputBase, 'raw.mp4'),
    annotatedVideo: join(outputBase, 'annotated.mp4'),
    thumbnail: join(outputBase, 'thumbnail.png'),
    report: join(outputBase, 'report.json'),
    frames: join(outputBase, 'frames'),
    tape: join(outputBase, `${scenario.name}.tape`),
  };

  console.log(`Recording scenario: ${scenario.name}`);
  const durationSeconds = await buildAndRecord(config, scenario, paths, projectDir);

  const annotationResult = config.annotation.enabled
    ? await runAnnotationPipeline(config, scenario, paths)
    : null;

  await writeReport(paths.report, config.project.name, scenario.name, durationSeconds, annotationResult);
  await updateLatestSymlink(projectDir, config.output.dir, timestamp);

  const result = buildResult(paths, config.annotation.enabled, durationSeconds, annotationResult);
  printSummary(result);
  return result;
}

interface RecordPaths {
  rawVideo: string;
  annotatedVideo: string;
  thumbnail: string;
  report: string;
  frames: string;
  tape: string;
}

async function buildAndRecord(config: Config, scenario: Scenario, paths: RecordPaths, projectDir: string): Promise<number> {
  const tapeContent = buildTape({ scenario, recording: config.recording, outputPath: paths.rawVideo });
  console.log('  \u2713 Tape generated');

  if (config.project.build_command) {
    console.log(`  Building: ${config.project.build_command}`);
    const execFileAsync = promisify(execFileCb);
    const [cmd, ...args] = config.project.build_command.split(/\s+/);
    await execFileAsync(cmd, args, { cwd: projectDir });
    console.log('  \u2713 Build complete');
  }

  const vhsResult = await runVhs(paths.tape, tapeContent);
  const durationSeconds = vhsResult.durationMs / 1000;
  console.log(`  \u2713 VHS recording complete (${durationSeconds.toFixed(1)}s)`);
  return durationSeconds;
}

async function runAnnotationPipeline(config: Config, scenario: Scenario, paths: RecordPaths) {
  const extraction = await extractFrames(paths.rawVideo, paths.frames, config.annotation.extract_fps);
  console.log(`  \u2713 Frames extracted (${extraction.frameCount} frames)`);

  const annotationResult = await annotateFrames(
    paths.frames,
    extraction.frameCount,
    config.project.name,
    config.project.description,
    scenario.description,
    config.annotation,
  );
  console.log('  \u2713 AI annotation complete');

  await postProcess({
    inputVideo: paths.rawVideo,
    outputVideo: paths.annotatedVideo,
    thumbnailPath: paths.thumbnail,
    frames: annotationResult.frames,
    overlayFontSize: config.annotation.overlay_font_size,
    overlayPosition: config.annotation.overlay_position,
    extractFps: config.annotation.extract_fps,
  });
  console.log('  \u2713 Video annotated');

  if (!config.output.keep_frames) {
    await rm(paths.frames, { recursive: true, force: true });
  }

  return annotationResult;
}

async function writeReport(
  reportPath: string,
  projectName: string,
  scenarioName: string,
  durationSeconds: number,
  annotationResult: Awaited<ReturnType<typeof annotateFrames>> | null,
) {
  const report = {
    project: projectName,
    scenario: scenarioName,
    timestamp: new Date().toISOString(),
    duration_seconds: durationSeconds,
    total_frames_analyzed: annotationResult?.frames.length ?? 0,
    overall_status: annotationResult?.overall_status ?? 'ok',
    frames: annotationResult?.frames ?? [],
    summary: annotationResult?.summary ?? 'Recording complete (no annotation).',
    bugs_found: annotationResult?.bugs_found ?? 0,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
}

async function updateLatestSymlink(projectDir: string, outputDir: string, timestamp: string) {
  const latestLink = resolve(projectDir, outputDir, 'latest');
  try {
    await unlink(latestLink);
  } catch {
    // symlink may not exist
  }
  await symlink(resolve(projectDir, outputDir, timestamp), latestLink);
}

function buildResult(
  paths: RecordPaths,
  annotationEnabled: boolean,
  durationSeconds: number,
  annotationResult: Awaited<ReturnType<typeof annotateFrames>> | null,
): RecordResult {
  const featuresDemo = annotationResult
    ? [...new Set(annotationResult.frames.map((f) => f.feature_being_demonstrated).filter(Boolean))]
    : [];

  return {
    success: true,
    videoPath: annotationEnabled ? paths.annotatedVideo : paths.rawVideo,
    rawVideoPath: paths.rawVideo,
    reportPath: paths.report,
    thumbnailPath: paths.thumbnail,
    summary: {
      status: annotationResult?.overall_status ?? 'ok',
      durationSeconds,
      framesAnalyzed: annotationResult?.frames.length ?? 0,
      bugsFound: annotationResult?.bugs_found ?? 0,
      featuresDemo,
      description: annotationResult?.summary ?? 'Recording complete.',
    },
  };
}

function printSummary(result: RecordResult) {
  console.log('');
  console.log('Result:');
  console.log(`  Video:     ${result.videoPath}`);
  console.log(`  Report:    ${result.reportPath}`);
  console.log(`  Thumbnail: ${result.thumbnailPath}`);
  console.log('');
  console.log(`Summary: ${result.summary.description}`);
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}
