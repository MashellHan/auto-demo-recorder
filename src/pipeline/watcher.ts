import { watch } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { minimatch } from 'minimatch';
import type { Config, Scenario, WatchConfig } from '../config/schema.js';
import { record, updateLatestSymlink, formatTimestamp } from '../index.js';
import { diffSessions, formatSessionDiff } from '../analytics/diff.js';
import type { Logger } from './annotator.js';

/** Options for starting a file watcher. */
export interface WatchOptions {
  config: Config;
  projectDir: string;
  scenario?: Scenario;
  logger?: Logger;
}

/** Handle returned by {@link startWatcher} to control the watch session. */
export interface WatchHandle {
  close: () => void;
}

const defaultLogger: Logger = {
  log: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
};

/** Start watching project files and auto-record on change. */
export function startWatcher(options: WatchOptions): WatchHandle {
  const { config, projectDir, scenario, logger: log = defaultLogger } = options;
  const watchConfig = config.watch;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let recording = false;

  const watcher = watch(projectDir, { recursive: true }, (_event, filename) => {
    if (!filename || recording) return;
    if (!matchesGlobs(filename, watchConfig)) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void triggerRecord(filename);
    }, watchConfig.debounce_ms);
  });

  async function triggerRecord(changedFile: string) {
    recording = true;
    log.log(`\nFile changed: ${changedFile}`);

    const scenarios = scenario ? [scenario] : config.scenarios;
    const timestamp = formatTimestamp(new Date());

    try {
      for (const s of scenarios) {
        await record({
          config,
          scenario: s,
          projectDir,
          logger: log,
          skipSymlinkUpdate: scenarios.length > 1,
          timestamp,
        });
      }
      if (scenarios.length > 1) {
        await updateLatestSymlink(projectDir, config.output.dir, timestamp);
      }

      // Auto-diff against previous session
      await runAutoDiff(config, projectDir, timestamp, log);
    } catch (error) {
      log.warn(`Recording failed: ${error instanceof Error ? error.message : error}`);
    }

    recording = false;
    log.log('\nWatching for changes...');
  }

  log.log(`Watching ${projectDir} for changes...`);
  log.log(`  Include: ${watchConfig.include.join(', ')}`);
  log.log(`  Exclude: ${watchConfig.exclude.join(', ')}`);
  log.log(`  Debounce: ${watchConfig.debounce_ms}ms`);
  if (scenario) {
    log.log(`  Scenario: ${scenario.name}`);
  } else {
    log.log(`  Scenarios: all (${config.scenarios.length})`);
  }
  log.log('');

  return {
    close: () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      watcher.close();
    },
  };
}

/** Check if a filename matches the include/exclude glob patterns. */
export function matchesGlobs(filename: string, watchConfig: WatchConfig): boolean {
  const included = watchConfig.include.some((pattern) => minimatch(filename, pattern));
  if (!included) return false;
  const excluded = watchConfig.exclude.some((pattern) => minimatch(filename, pattern));
  return !excluded;
}

/**
 * Find the previous session directory and run a diff against the current one.
 * Silently skips if no previous session exists.
 */
export async function runAutoDiff(config: Config, projectDir: string, currentTimestamp: string, log: Logger): Promise<void> {
  const outputDir = resolve(projectDir, config.output.dir);

  try {
    const entries = await readdir(outputDir);
    // Filter to timestamp-like directories (YYYY-MM-DD_HH-MM), sorted
    const sessions = entries
      .filter((e) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/.test(e))
      .sort();

    const currentIdx = sessions.indexOf(currentTimestamp);
    if (currentIdx <= 0) {
      // No previous session or current not found
      return;
    }

    const previousTimestamp = sessions[currentIdx - 1];
    log.log('\nAuto-diff vs previous session:');

    const result = await diffSessions(outputDir, previousTimestamp, currentTimestamp);
    const summary = formatSessionDiff(result);
    log.log(summary);

    if (result.regressed > 0) {
      log.warn(`⚠ ${result.regressed} scenario(s) regressed since ${previousTimestamp}`);
    }
  } catch {
    // Silently skip diff on any filesystem or parse error
  }
}
