import { mkdir, writeFile, symlink, unlink, rm } from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import type { Config, Scenario } from './config/schema.js';
import { buildTape } from './pipeline/tape-builder.js';
import { runVhs } from './pipeline/vhs-runner.js';
import { extractFrames } from './pipeline/frame-extractor.js';
import { annotateFrames, type Logger } from './pipeline/annotator.js';
import { postProcess } from './pipeline/post-processor.js';

export { loadConfig, findScenario } from './config/loader.js';
export { ConfigSchema } from './config/schema.js';
export type { Config, Scenario } from './config/schema.js';
export type { Logger } from './pipeline/annotator.js';

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
  logger?: Logger;
}

const defaultLogger: Logger = {
  log: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
};

export async function record(options: RecordOptions): Promise<RecordResult> {
  const { config, scenario, projectDir, logger: log = defaultLogger } = options;

  const timestamp = formatTimestamp(new Date());
  const outputBase = resolve(projectDir, config.output.dir, timestamp, scenario.name);
  await mkdir(outputBase, { recursive: true });

  const ext = config.recording.format === 'gif' ? 'gif' : 'mp4';
  const paths = {
    rawVideo: join(outputBase, `raw.${ext}`),
    annotatedVideo: join(outputBase, `annotated.${ext}`),
    thumbnail: join(outputBase, 'thumbnail.png'),
    report: join(outputBase, 'report.json'),
    frames: join(outputBase, 'frames'),
    tape: join(outputBase, `${scenario.name}.tape`),
  };

  log.log(`Recording scenario: ${scenario.name}`);
  const durationSeconds = await buildAndRecord(config, scenario, paths, projectDir, log);

  const annotationResult = config.annotation.enabled
    ? await runAnnotationPipeline(config, scenario, paths, log, config.recording.format === 'gif')
    : null;

  await writeReport(paths.report, config.project.name, scenario.name, durationSeconds, annotationResult);
  await updateLatestSymlink(projectDir, config.output.dir, timestamp);

  const hasAnnotatedVideo = config.annotation.enabled && config.recording.format !== 'gif';
  const result = buildResult(paths, hasAnnotatedVideo, durationSeconds, annotationResult);
  printSummary(result, log);
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

async function buildAndRecord(config: Config, scenario: Scenario, paths: RecordPaths, projectDir: string, log: Logger): Promise<number> {
  const tapeContent = buildTape({ scenario, recording: config.recording, outputPath: paths.rawVideo });
  log.log('  \u2713 Tape generated');

  if (config.project.build_command) {
    log.log(`  Building: ${config.project.build_command}`);
    const execFileAsync = promisify(execFileCb);
    const [cmd, ...args] = config.project.build_command.split(/\s+/);
    await execFileAsync(cmd, args, { cwd: projectDir });
    log.log('  \u2713 Build complete');
  }

  const vhsResult = await runVhs(paths.tape, tapeContent);
  const durationSeconds = vhsResult.durationMs / 1000;
  log.log(`  \u2713 VHS recording complete (${durationSeconds.toFixed(1)}s)`);
  return durationSeconds;
}

async function runAnnotationPipeline(config: Config, scenario: Scenario, paths: RecordPaths, log: Logger, skipOverlay: boolean = false) {
  const extraction = await extractFrames(paths.rawVideo, paths.frames, config.annotation.extract_fps);
  log.log(`  \u2713 Frames extracted (${extraction.frameCount} frames)`);

  const annotationResult = await annotateFrames(
    paths.frames,
    extraction.frameCount,
    config.project.name,
    config.project.description,
    scenario.description,
    config.annotation,
    log,
  );
  log.log('  \u2713 AI annotation complete');

  if (skipOverlay) {
    log.log('  (GIF format: skipping overlay, annotations in report only)');
  } else {
    await postProcess({
      inputVideo: paths.rawVideo,
      outputVideo: paths.annotatedVideo,
      thumbnailPath: paths.thumbnail,
      frames: annotationResult.frames,
      overlayFontSize: config.annotation.overlay_font_size,
      overlayPosition: config.annotation.overlay_position,
      extractFps: config.annotation.extract_fps,
    });
    log.log('  \u2713 Video annotated');
  }

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

function printSummary(result: RecordResult, log: Logger) {
  log.log('');
  log.log('Result:');
  log.log(`  Video:     ${result.videoPath}`);
  log.log(`  Report:    ${result.reportPath}`);
  log.log(`  Thumbnail: ${result.thumbnailPath}`);
  log.log('');
  log.log(`Summary: ${result.summary.description}`);
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}
