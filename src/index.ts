import { mkdir, writeFile, readFile, symlink, unlink, rm, realpath } from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Config, Scenario, BrowserScenario } from './config/schema.js';
import { buildTape } from './pipeline/tape-builder.js';
import { runVhs } from './pipeline/vhs-runner.js';
import { runBrowser } from './pipeline/browser-runner.js';
import { extractFrames } from './pipeline/frame-extractor.js';
import { annotateFrames, type Logger } from './pipeline/annotator.js';
import { postProcess } from './pipeline/post-processor.js';
import { generatePlayer } from './pipeline/player-generator.js';
import { generateDocs } from './pipeline/doc-generator.js';
import { generateSvgFromReport } from './pipeline/svg-generator.js';
import { compareReports, writeSessionReport, type Report } from './pipeline/regression.js';

/** Load and validate a demo-recorder.yaml config file. */
export { loadConfig, findScenario, deepMerge } from './config/loader.js';
/** Zod schema for validating demo-recorder config objects. */
export { ConfigSchema } from './config/schema.js';
export type { Config, Scenario, BrowserScenario } from './config/schema.js';
export type { Logger } from './pipeline/annotator.js';
/** Regression detection utilities for comparing recording reports. */
export { detectRegressions, compareReports, loadReport, writeSessionReport } from './pipeline/regression.js';
export type { RegressionResult, RegressionChange, Report, SessionReport } from './pipeline/regression.js';
/** File watcher for auto-recording on source changes. */
export { startWatcher, matchesGlobs } from './pipeline/watcher.js';
export type { WatchOptions, WatchHandle } from './pipeline/watcher.js';
/** Browser recording utilities. */
export { runBrowser } from './pipeline/browser-runner.js';
export { executeStep, executeAllSteps, parsePause, mapKeyName } from './pipeline/browser-step-executor.js';
/** Theme gallery utilities. */
export { VHS_THEMES, findTheme, getThemeNames, resolveThemeId } from './config/themes.js';
export type { ThemeInfo } from './config/themes.js';
/** HTML player generator. */
export { generatePlayer } from './pipeline/player-generator.js';
export type { PlayerOptions } from './pipeline/player-generator.js';
/** AI documentation generator. */
export { generateDocs } from './pipeline/doc-generator.js';
export type { DocGeneratorOptions } from './pipeline/doc-generator.js';
/** SVG terminal image generator. */
export { generateSvg, generateSvgFromReport } from './pipeline/svg-generator.js';
export type { SvgGeneratorOptions, SvgTheme } from './pipeline/svg-generator.js';
/** HTML report dashboard generator. */
export { generateReport } from './pipeline/report-generator.js';
export type { ReportDashboardOptions } from './pipeline/report-generator.js';
/** AI chapter and table of contents generator. */
export { generateChapters, generateTableOfContents, renderTocMarkdown, renderChaptersHtml } from './pipeline/chapter-generator.js';
export type { Chapter, TableOfContents } from './pipeline/chapter-generator.js';
/** Asciicast v2 interop (import/export). */
export { parseAsciicast, serializeAsciicast, loadAsciicast, saveAsciicast, reportToAsciicast, asciicastToReport } from './pipeline/asciicast.js';
export type { Asciicast, AsciicastHeader, AsciicastEvent } from './pipeline/asciicast.js';
/** Presentation generator. */
export { generatePresentation } from './pipeline/presentation-generator.js';
export type { PresentationOptions } from './pipeline/presentation-generator.js';
/** Bundle manifest generator for shareable recording packages. */
export { createBundleManifest, writeBundleManifest, formatManifestSummary } from './pipeline/bundler.js';
export type { BundleOptions, BundleManifest, BundleFile } from './pipeline/bundler.js';
/** Recording analytics and statistics. */
export { computeStats, formatStats } from './analytics/stats.js';
export type { RecordingStats, QualityDataPoint } from './analytics/stats.js';
/** Recording session comparison. */
export { diffSessions, formatSessionDiff } from './analytics/diff.js';
export type { SessionDiffResult, ScenarioDiff } from './analytics/diff.js';
/** Changelog generation from recording history. */
export { generateChangelog, formatChangelog } from './analytics/changelog.js';
export type { ChangelogEntry, SessionData } from './analytics/changelog.js';
/** Concurrency limiter for parallel recording. */
export { pLimit } from './pipeline/concurrency.js';
/** Recording session export/archive utilities. */
export { createArchive, listSessionArtifacts } from './pipeline/exporter.js';
export type { ArchiveResult, SessionArtifacts } from './pipeline/exporter.js';
/** Recording replay utilities. */
export { buildReplayPlan, formatReplayStep, formatReplayHeader } from './pipeline/replay.js';
export type { ReplayPlan, ReplayStep } from './pipeline/replay.js';
/** Recording profiles. */
export { BUILT_IN_PROFILES, getProfile, getProfileNames, applyProfile, getAllProfiles, parseCustomProfiles } from './config/profiles.js';
export type { RecordingProfile } from './config/profiles.js';
/** Retry utility for recording resilience. */
export { withRetry } from './pipeline/retry.js';
export type { RetryOptions } from './pipeline/retry.js';
/** Post-recording notification utilities. */
export { buildNotification, formatNotificationSummary, sendWebhook, runNotificationCommand } from './pipeline/notifier.js';
export type { NotificationPayload } from './pipeline/notifier.js';
/** Scenario dependency resolution. */
export { buildDependencyOrder, validateDependencies } from './config/dependencies.js';
export type { DependencyScenario } from './config/dependencies.js';
/** Utility to resolve user-supplied session paths, stripping output dir prefix. */
export { resolveSessionPath } from './cli-utils.js';
/** Step timing analysis for recorded scenarios. */
export { analyzeTimingFromReport, analyzeTimingFromData, renderTimingChart, formatTimingReport } from './analytics/timing.js';
export type { StepTiming, TimingAnalysis } from './analytics/timing.js';
/** Environment snapshot capture. */
export { captureEnvironmentSnapshot, formatEnvironmentSnapshot } from './pipeline/environment.js';
export type { EnvironmentSnapshot } from './pipeline/environment.js';
/** Config migration utilities. */
export { migrateConfig, formatMigrationReport } from './config/migration.js';
export type { MigrationStep, MigrationResult } from './config/migration.js';
/** Recording session pruning. */
export { pruneRecordings, formatPruneReport } from './pipeline/prune.js';
export type { PruneOptions, PruneResult } from './pipeline/prune.js';
/** CI configuration generation. */
export { generateCIConfig, getSupportedProviders } from './config/ci-generator.js';
export type { CIProvider, CIConfigOptions, CIConfigResult } from './config/ci-generator.js';
/** Health check for tool availability. */
export { runHealthCheck, formatHealthCheck } from './pipeline/health-check.js';
export type { HealthCheckItem, HealthCheckResult } from './pipeline/health-check.js';
/** Recording baseline management. */
export { saveBaseline, checkBaseline, listBaselines, formatBaselineComparison } from './analytics/baseline.js';
export type { BaselineComparison, BaselineChange, BaselineData } from './analytics/baseline.js';
/** JSON Schema export for IDE autocomplete. */
export { exportJsonSchema } from './config/schema-export.js';
/** Multi-language annotation presets. */
export { ANNOTATION_LANGUAGES, findLanguage, getLanguageInstruction, listLanguages } from './config/languages.js';
export type { AnnotationLanguage } from './config/languages.js';
/** Scenario templates library. */
export { SCENARIO_TEMPLATES, findTemplate, listTemplates, listTemplatesByCategory, getTemplateCategories } from './config/templates.js';
export type { ScenarioTemplate } from './config/templates.js';
/** Visual diff for frame descriptions. */
export { visualDiff, compareFrameDescriptions, formatVisualDiff } from './analytics/visual-diff.js';
export type { FrameDiff, VisualDiffResult } from './analytics/visual-diff.js';
/** Recording quality metrics. */
export { computeMetrics, formatMetrics } from './analytics/metrics.js';
export type { ScenarioMetric, QualityMetrics } from './analytics/metrics.js';
/** Recording session summary dashboard. */
export { generateSessionSummary, summarizeSession, formatSessionSummary } from './pipeline/summary.js';
export type { ScenarioSummary, SessionSummary } from './pipeline/summary.js';
/** Comparison matrix across sessions. */
export { generateComparisonMatrix, formatComparisonMatrix } from './analytics/comparison-matrix.js';
export type { MatrixCell, MatrixRow, ComparisonMatrix } from './analytics/comparison-matrix.js';
/** Tag-level analytics. */
export { computeTagStats, formatTagStats } from './analytics/tag-stats.js';
export type { TagStat, TagAnalytics } from './analytics/tag-stats.js';
/** Config extends chain resolution. */
export { resolveExtendsChain, validateExtends, formatExtendsChain } from './config/extends-resolver.js';
export type { ExtendsResolution } from './config/extends-resolver.js';
/** Configurable cleanup policies. */
export { evaluateCleanupPolicy, formatCleanupEvaluation, CleanupPolicySchema } from './config/cleanup-policy.js';
export type { CleanupPolicy, CleanupEvaluation, SessionInfo } from './config/cleanup-policy.js';

/** Result returned by {@link record} after a recording session. */
export interface RecordResult {
  /** Whether the recording completed successfully. */
  success: boolean;
  /** Path to the annotated video (or raw if annotation disabled). */
  videoPath: string;
  /** Path to the raw (unannotated) video. */
  rawVideoPath: string;
  /** Path to the JSON analysis report. */
  reportPath: string;
  /** Path to the thumbnail image (first frame). */
  thumbnailPath: string;
  /** Summary of the recording analysis. */
  summary: {
    status: string;
    durationSeconds: number;
    framesAnalyzed: number;
    bugsFound: number;
    featuresDemo: string[];
    description: string;
  };
  /** Regression info when a previous recording exists for comparison. */
  regression?: {
    has_regressions: boolean;
    changes: Array<{ type: string; description: string; severity: string }>;
    summary: string;
  };
  /** False when recording was pruned by retain-on-failure mode. */
  retained?: boolean;
  /** Extra video paths when multi-format output is used. */
  extraVideoPaths?: string[];
  /** Path to the HTML player file (when player output is enabled). */
  playerPath?: string;
  /** Path to the generated documentation file (when docs output is enabled). */
  docsPath?: string;
  /** Path to the generated SVG file (when SVG format is used). */
  svgPath?: string;
}

/** Options for the {@link record} function (VHS terminal backend). */
export interface RecordOptions {
  /** Validated project configuration. */
  config: Config;
  /** Scenario to record. */
  scenario: Scenario;
  /** Absolute path to the project directory. */
  projectDir: string;
  /** Custom logger for pipeline progress output. */
  logger?: Logger;
  /** Skip updating the `latest` symlink (used for parallel recording). */
  skipSymlinkUpdate?: boolean;
  /** Override timestamp for the output directory (used for multi-scenario sessions). */
  timestamp?: string;
}

/** Options for the {@link recordBrowser} function. */
export interface BrowserRecordOptions {
  /** Validated project configuration. */
  config: Config;
  /** Browser scenario to record. */
  scenario: BrowserScenario;
  /** Absolute path to the project directory. */
  projectDir: string;
  /** Custom logger for pipeline progress output. */
  logger?: Logger;
  /** Skip updating the `latest` symlink (used for parallel recording). */
  skipSymlinkUpdate?: boolean;
  /** Override timestamp for the output directory (used for multi-scenario sessions). */
  timestamp?: string;
}

const defaultLogger: Logger = {
  log: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
};

/**
 * Record a terminal demo scenario: builds the project, runs VHS to capture video,
 * optionally extracts frames for AI annotation, writes a JSON report, and checks
 * for regressions against the previous recording.
 *
 * @param options - Recording configuration including scenario, project dir, and logger.
 * @returns Result object with paths to video, report, thumbnail, and analysis summary.
 */
export async function record(options: RecordOptions): Promise<RecordResult> {
  const { config, scenario, projectDir, logger: log = defaultLogger, skipSymlinkUpdate = false, timestamp: overrideTimestamp } = options;

  // Run before hook
  await runHook(scenario.hooks?.before, 'before', projectDir, log);

  try {
    const timestamp = overrideTimestamp ?? formatTimestamp(new Date());
    const outputBase = resolve(projectDir, config.output.dir, timestamp, scenario.name);
    await mkdir(outputBase, { recursive: true });

    const ext = config.recording.format === 'gif' ? 'gif' : 'mp4';
    const formats = config.recording.formats ?? [config.recording.format];
    const primaryFormat = formats[0] === 'gif' ? 'gif' : 'mp4';
    const extraFormats = formats.slice(1);
    const paths = {
      rawVideo: join(outputBase, `raw.${primaryFormat}`),
      annotatedVideo: join(outputBase, `annotated.${primaryFormat}`),
      thumbnail: join(outputBase, 'thumbnail.png'),
      report: join(outputBase, 'report.json'),
      frames: join(outputBase, 'frames'),
      tape: join(outputBase, `${scenario.name}.tape`),
    };
    const extraOutputPaths = extraFormats.map((f) => join(outputBase, `raw.${f}`));

    log.log(`Recording scenario: ${scenario.name}`);
    const durationSeconds = await buildAndRecord(config, scenario, paths, projectDir, log, extraOutputPaths);

    const isGif = primaryFormat === 'gif';
    const annotationResult = config.annotation.enabled
      ? await runAnnotationPipeline(config, scenario, paths, log, isGif)
      : null;

    await writeReport(paths.report, config.project.name, scenario.name, durationSeconds, annotationResult);

    // Auto-regression: compare with previous report for same scenario
    const regressionInfo = await checkPreviousReport(projectDir, config.output.dir, scenario.name, paths.report, log);

    if (!skipSymlinkUpdate) {
      await updateLatestSymlink(projectDir, config.output.dir, timestamp);
    }

    const hasAnnotatedVideo = config.annotation.enabled && primaryFormat !== 'gif';
    const result = buildResult(paths, hasAnnotatedVideo, durationSeconds, annotationResult, regressionInfo);
    if (extraOutputPaths.length > 0) {
      result.extraVideoPaths = extraOutputPaths;
    }

    // Generate HTML player if enabled
    if (config.output.player) {
      const playerPath = join(outputBase, 'player.html');
      await generatePlayer({
        videoPath: result.videoPath,
        reportPath: paths.report,
        outputPath: playerPath,
        projectName: config.project.name,
        scenarioName: scenario.name,
      });
      result.playerPath = playerPath;
      log.log('  ✓ HTML player generated');
    }

    // Generate markdown documentation if enabled
    if (config.output.docs) {
      const docsPath = join(outputBase, 'DEMO.md');
      await generateDocs({
        reportPath: paths.report,
        outputPath: docsPath,
        projectName: config.project.name,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        includeScreenshots: config.output.keep_frames,
        framesDir: config.output.keep_frames ? 'frames' : undefined,
      });
      result.docsPath = docsPath;
      log.log('  ✓ Documentation generated');
    }

    // Generate SVG if format includes svg
    if (formats.includes('svg')) {
      const svgPath = join(outputBase, 'recording.svg');
      await generateSvgFromReport({
        reportPath: paths.report,
        outputPath: svgPath,
        title: `${config.project.name} — ${scenario.name}`,
      });
      result.svgPath = svgPath;
      log.log('  ✓ SVG generated');
    }

    // Retain-on-failure: prune clean recordings to save disk space
    if (config.output.record_mode === 'retain-on-failure') {
      const hasBugs = (annotationResult?.bugs_found ?? 0) > 0;
      const hasErrors = annotationResult?.overall_status === 'error' || annotationResult?.overall_status === 'warning';
      if (!hasBugs && !hasErrors) {
        await rm(outputBase, { recursive: true, force: true });
        log.log(`  ✓ Clean recording pruned (retain-on-failure mode)`);
        return { ...result, retained: false };
      }
    }

    printSummary(result, log);
    return result;
  } finally {
    // Run after hook (always, even on error)
    await runHook(scenario.hooks?.after, 'after', projectDir, log);
  }
}

/**
 * Record a browser demo scenario using Playwright: launches browser, executes steps,
 * captures video, optionally annotates with AI, and generates a report.
 *
 * @param options - Browser recording configuration including scenario, project dir, and logger.
 * @returns Result object with paths to video, report, thumbnail, and analysis summary.
 */
export async function recordBrowser(options: BrowserRecordOptions): Promise<RecordResult> {
  const { config, scenario, projectDir, logger: log = defaultLogger, skipSymlinkUpdate = false, timestamp: overrideTimestamp } = options;

  // Run before hook
  await runHook(scenario.hooks?.before, 'before', projectDir, log);

  try {
    const timestamp = overrideTimestamp ?? formatTimestamp(new Date());
    const outputBase = resolve(projectDir, config.output.dir, timestamp, scenario.name);
    await mkdir(outputBase, { recursive: true });

    const paths = {
      rawVideo: join(outputBase, 'raw.webm'),
      annotatedVideo: join(outputBase, 'annotated.mp4'),
      thumbnail: join(outputBase, 'thumbnail.png'),
      report: join(outputBase, 'report.json'),
      frames: join(outputBase, 'frames'),
      tape: join(outputBase, `${scenario.name}.tape`), // unused for browser, kept for interface compat
    };

    log.log(`Recording browser scenario: ${scenario.name}`);

    if (config.project.build_command) {
      log.log(`  Building: ${config.project.build_command}`);
      const execFileAsync = promisify(execFileCb);
      const [cmd, ...args] = config.project.build_command.split(/\s+/);
      await execFileAsync(cmd, args, { cwd: projectDir });
      log.log('  ✓ Build complete');
    }

    const browserResult = await runBrowser(scenario, config.recording, paths.rawVideo, log);
    const durationSeconds = browserResult.durationMs / 1000;

    const annotationResult = config.annotation.enabled
      ? await runAnnotationPipeline(config, { name: scenario.name, description: scenario.description, setup: [], steps: [], tags: [], depends_on: [] }, paths, log, false)
      : null;

    await writeReport(paths.report, config.project.name, scenario.name, durationSeconds, annotationResult);

    const regressionInfo = await checkPreviousReport(projectDir, config.output.dir, scenario.name, paths.report, log);

    if (!skipSymlinkUpdate) {
      await updateLatestSymlink(projectDir, config.output.dir, timestamp);
    }

    const hasAnnotatedVideo = config.annotation.enabled;
    const result = buildResult(paths, hasAnnotatedVideo, durationSeconds, annotationResult, regressionInfo);

    // Generate HTML player if enabled
    if (config.output.player) {
      const playerPath = join(outputBase, 'player.html');
      await generatePlayer({
        videoPath: result.videoPath,
        reportPath: paths.report,
        outputPath: playerPath,
        projectName: config.project.name,
        scenarioName: scenario.name,
      });
      result.playerPath = playerPath;
      log.log('  ✓ HTML player generated');
    }

    // Generate markdown documentation if enabled
    if (config.output.docs) {
      const docsPath = join(outputBase, 'DEMO.md');
      await generateDocs({
        reportPath: paths.report,
        outputPath: docsPath,
        projectName: config.project.name,
        scenarioName: scenario.name,
        scenarioDescription: scenario.description,
        includeScreenshots: config.output.keep_frames,
        framesDir: config.output.keep_frames ? 'frames' : undefined,
      });
      result.docsPath = docsPath;
      log.log('  ✓ Documentation generated');
    }

    // Retain-on-failure: prune clean recordings to save disk space
    if (config.output.record_mode === 'retain-on-failure') {
      const hasBugs = (annotationResult?.bugs_found ?? 0) > 0;
      const hasErrors = annotationResult?.overall_status === 'error' || annotationResult?.overall_status === 'warning';
      if (!hasBugs && !hasErrors) {
        await rm(outputBase, { recursive: true, force: true });
        log.log(`  ✓ Clean recording pruned (retain-on-failure mode)`);
        return { ...result, retained: false };
      }
    }

    printSummary(result, log);
    return result;
  } finally {
    // Run after hook (always, even on error)
    await runHook(scenario.hooks?.after, 'after', projectDir, log);
  }
}

interface RecordPaths {
  rawVideo: string;
  annotatedVideo: string;
  thumbnail: string;
  report: string;
  frames: string;
  tape: string;
}

async function buildAndRecord(config: Config, scenario: Scenario, paths: RecordPaths, projectDir: string, log: Logger, extraOutputPaths: string[] = []): Promise<number> {
  const tapeContent = buildTape({ scenario, recording: config.recording, outputPath: paths.rawVideo, extraOutputPaths });
  log.log('  ✓ Tape generated');

  if (config.project.build_command) {
    log.log(`  Building: ${config.project.build_command}`);
    const execFileAsync = promisify(execFileCb);
    const [cmd, ...args] = config.project.build_command.split(/\s+/);
    await execFileAsync(cmd, args, { cwd: projectDir });
    log.log('  ✓ Build complete');
  }

  const vhsResult = await runVhs(paths.tape, tapeContent);
  const durationSeconds = vhsResult.durationMs / 1000;
  log.log(`  ✓ VHS recording complete (${durationSeconds.toFixed(1)}s)`);
  return durationSeconds;
}

async function runAnnotationPipeline(config: Config, scenario: Scenario, paths: RecordPaths, log: Logger, skipOverlay: boolean = false) {
  const extraction = await extractFrames(paths.rawVideo, paths.frames, config.annotation.extract_fps);
  log.log(`  ✓ Frames extracted (${extraction.frameCount} frames)`);

  const annotationResult = await annotateFrames(
    paths.frames,
    extraction.frameCount,
    config.project.name,
    config.project.description,
    scenario.description,
    config.annotation,
    log,
  );
  log.log('  ✓ AI annotation complete');

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
    log.log('  ✓ Video annotated');
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
  const report: Report = {
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

/**
 * Create or update the `latest` symlink in the output directory to point to the given timestamp folder.
 * Exported for use in parallel recording workflows where symlink updates are deferred.
 */
export async function updateLatestSymlink(projectDir: string, outputDir: string, timestamp: string) {
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
  regressionInfo?: RecordResult['regression'],
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
    regression: regressionInfo,
  };
}

async function checkPreviousReport(
  projectDir: string,
  outputDir: string,
  scenarioName: string,
  currentReportPath: string,
  log: Logger,
): Promise<RecordResult['regression'] | undefined> {
  try {
    const latestLink = resolve(projectDir, outputDir, 'latest');
    if (!existsSync(latestLink)) return undefined;

    const latestDir = await realpath(latestLink);
    const previousReportPath = join(latestDir, scenarioName, 'report.json');

    if (!existsSync(previousReportPath)) return undefined;

    const previousContent = await readFile(previousReportPath, 'utf-8');
    const currentContent = await readFile(currentReportPath, 'utf-8');
    const previousReport = JSON.parse(previousContent) as Report;
    const currentReport = JSON.parse(currentContent) as Report;

    const changes = compareReports(previousReport, currentReport);
    if (changes.length === 0) {
      log.log('  ✓ No regressions from previous recording');
      return undefined;
    }

    const hasRegressions = changes.some(
      (c) => c.severity === 'critical' || c.severity === 'warning',
    );

    for (const change of changes) {
      const icon = change.severity === 'critical' ? '✗' : change.severity === 'warning' ? '!' : '✓';
      log.log(`  ${icon} [${change.severity.toUpperCase()}] ${change.description}`);
    }

    const summary = `${changes.length} changes vs previous (${changes.filter((c) => c.severity === 'critical').length} critical, ${changes.filter((c) => c.severity === 'warning').length} warning)`;
    return { has_regressions: hasRegressions, changes, summary };
  } catch {
    // If anything fails reading previous report, skip regression check silently
    return undefined;
  }
}

/**
 * Execute a lifecycle hook command via shell.
 * Silently returns if no command is provided or if the command fails
 * (after hooks should not prevent result delivery).
 */
async function runHook(command: string | undefined, phase: 'before' | 'after', cwd: string, log: Logger): Promise<void> {
  if (!command) return;
  log.log(`  Running ${phase} hook: ${command}`);
  try {
    const execFileAsync = promisify(execFileCb);
    await execFileAsync('sh', ['-c', command], { cwd });
    log.log(`  ✓ ${phase} hook complete`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`  ⚠ ${phase} hook failed: ${msg}`);
    if (phase === 'before') throw err;
    // after hooks don't re-throw — we still want to return results
  }
}

function printSummary(result: RecordResult, log: Logger) {
  log.log('');
  log.log('Result:');
  log.log(`  Video:     ${result.videoPath}`);
  log.log(`  Report:    ${result.reportPath}`);
  if (result.summary.framesAnalyzed > 0) {
    log.log(`  Thumbnail: ${result.thumbnailPath}`);
  }
  log.log('');
  log.log(`Summary: ${result.summary.description}`);
}

/** Format a Date as a filesystem-safe timestamp string (YYYY-MM-DD_HH-MM). */
export function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}
