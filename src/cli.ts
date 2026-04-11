import { Command } from 'commander';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadConfig, findScenario } from './config/loader.js';
import { scanProject, generateConfig } from './config/scanner.js';
import { formatTimestamp } from './index.js';
import { startMcpServer } from './mcp/server.js';
import { detectRegressions } from './pipeline/regression.js';
import { startWatcher } from './pipeline/watcher.js';
import { VHS_THEMES, findTheme, resolveThemeId } from './config/themes.js';
import { computeStats, formatStats } from './analytics/stats.js';
import { diffSessions, formatSessionDiff } from './analytics/diff.js';
import { generateChangelog, formatChangelog } from './analytics/changelog.js';
import { validateConfig, formatDryRun, getTerminalTemplate, getBrowserTemplate, resolveSessionPath } from './cli-utils.js';
import { filterByTag, handleVhsRecord, handleBrowserRecord, handleAdhocRecord, loadChangelogSessions } from './cli-handlers.js';
import { createArchive, listSessionArtifacts } from './pipeline/exporter.js';
import { BUILT_IN_PROFILES, getProfile, getProfileNames, applyProfile, parseCustomProfiles, getAllProfiles } from './config/profiles.js';
import { buildReplayPlan, formatReplayStep, formatReplayHeader } from './pipeline/replay.js';
import { registerCommands } from './cli-commands.js';
import { generateValidationHints, formatValidationHints } from './config/validation-hints.js';
import type { BrowserScenario } from './config/schema.js';
import type { Logger } from './pipeline/annotator.js';

export { validateConfig, formatDryRun, getTerminalTemplate, getBrowserTemplate, resolveSessionPath } from './cli-utils.js';
export { filterByTag } from './cli-handlers.js';

const noopLogger: Logger = { log: () => {}, warn: () => {} };

export function createCli(): Command {
  const program = new Command();

  program
    .name('demo-recorder')
    .description('On-demand terminal & browser demo recording + AI annotation CLI tool')
    .version('1.0.0');

  program
    .command('record')
    .description('Record a demo video (terminal or browser)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-s, --scenario <name>', 'Scenario name to record')
    .option('--no-annotate', 'Skip AI annotation')
    .option('--format <format>', 'Output format: mp4 or gif', 'mp4')
    .option('-q, --quiet', 'Suppress progress output')
    .option('--backend <backend>', 'Recording backend: vhs or browser')
    .option('--adhoc', 'Ad-hoc recording mode (no config file needed)')
    .option('--command <cmd>', 'Command to run (used with --adhoc)')
    .option('--steps <steps>', 'Comma-separated steps: j,k,Enter,sleep:2s,q (used with --adhoc)')
    .option('--width <n>', 'Terminal width (used with --adhoc)', '1200')
    .option('--height <n>', 'Terminal height (used with --adhoc)', '800')
    .option('--url <url>', 'Starting URL for browser recording (used with --adhoc --backend browser)')
    .option('--theme <theme>', 'Override recording theme (use "demo-recorder themes" to list)')
    .option('--tag <tag>', 'Filter scenarios by tag (prefix with "!" to exclude)')
    .option('--dry-run', 'Preview recording plan without executing')
    .option('--parallel', 'Record scenarios in parallel')
    .option('--workers <n>', 'Max concurrent recordings (default: 3)', '3')
    .option('--profile <name>', 'Apply a recording profile (ci, demo, quick, presentation)')
    .option('--retry <n>', 'Retry failed recordings N times (default: 0)', '0')
    .action(async (opts) => {
      try {
        const logger = opts.quiet ? noopLogger : undefined;

        if (opts.adhoc) {
          await handleAdhocRecord(opts, logger);
          return;
        }

        const loaded = await loadConfig(opts.config);

        // Apply profile overrides if specified
        const customProfiles = parseCustomProfiles((loaded as any).profiles);
        const profiled = opts.profile
          ? applyProfile(loaded as Record<string, unknown>, (() => {
              const p = getProfile(opts.profile, customProfiles);
              if (!p) throw new Error(`Unknown profile "${opts.profile}". Available: ${getProfileNames(customProfiles).join(', ')}`);
              return p;
            })()) as typeof loaded
          : loaded;

        const config = {
          ...profiled,
          annotation: {
            ...profiled.annotation,
            ...(opts.annotate === false && { enabled: false }),
          },
          recording: {
            ...profiled.recording,
            ...(opts.format === 'gif' && { format: 'gif' as const }),
            ...(opts.backend && { backend: opts.backend as 'vhs' | 'browser' }),
            ...(opts.theme && { theme: resolveThemeId(opts.theme) }),
          },
        };

        const backend = config.recording.backend;
        const projectDir = process.cwd();

        if (opts.dryRun) {
          if (backend === 'browser') {
            let scenarios: BrowserScenario[] = opts.scenario
              ? [(config as any).browser_scenarios.find((s: BrowserScenario) => s.name === opts.scenario)]
              : (config as any).browser_scenarios;
            if (opts.tag) scenarios = filterByTag(scenarios, opts.tag);
            for (const s of scenarios) {
              console.log(formatDryRun(s, config, 'browser'));
            }
          } else {
            let scenarios = opts.scenario
              ? [findScenario(config as any, opts.scenario)]
              : (config as any).scenarios;
            if (opts.tag) scenarios = filterByTag(scenarios, opts.tag);
            for (const s of scenarios) {
              console.log(formatDryRun(s, config, 'vhs'));
            }
          }
          return;
        }

        const isParallel = opts.parallel || config.recording.parallel;
        const maxWorkers = parseInt(opts.workers, 10) || config.recording.max_workers || 3;
        const maxRetries = parseInt(opts.retry ?? '0', 10);

        if (backend === 'browser') {
          await handleBrowserRecord(config, opts.scenario, projectDir, logger, opts.quiet, opts.tag, isParallel, maxWorkers, maxRetries);
        } else {
          await handleVhsRecord(config, opts.scenario, projectDir, logger, opts.quiet, opts.tag, isParallel, maxWorkers, maxRetries);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('list')
    .description('List available scenarios')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--tag <tag>', 'Filter scenarios by tag')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        console.log(`Project: ${config.project.name}`);

        let terminalScenarios = config.scenarios;
        let browserScenarios = config.browser_scenarios;
        if (opts.tag) {
          terminalScenarios = filterByTag(terminalScenarios, opts.tag);
          browserScenarios = filterByTag(browserScenarios, opts.tag);
        }

        if (terminalScenarios.length > 0) {
          console.log(`Terminal Scenarios:`);
          for (const s of terminalScenarios) {
            const tags = (s as any).tags ?? [];
            const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
            console.log(`  - ${s.name}: ${s.description}${tagStr}`);
            console.log(`    Steps: ${s.steps.length}, Setup: ${s.setup.length} commands`);
          }
        }

        if (browserScenarios.length > 0) {
          console.log(`Browser Scenarios:`);
          for (const s of browserScenarios) {
            const tags = (s as any).tags ?? [];
            const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
            console.log(`  - ${s.name}: ${s.description}${tagStr}`);
            console.log(`    URL: ${s.url}, Steps: ${s.steps.length}`);
          }
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('validate')
    .description('Validate config file and report warnings')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        const output = validateConfig(config);
        console.log(output);
      } catch (error) {
        console.error(`✗ Config invalid: ${error instanceof Error ? error.message : error}`);
        // Show actionable hints if it's a Zod validation error
        if (error && typeof error === 'object' && 'issues' in error) {
          const { z } = await import('zod');
          if (error instanceof z.ZodError) {
            const hints = generateValidationHints(error);
            if (hints.length > 0) {
              console.log('');
              console.log(formatValidationHints(hints));
            }
          }
        }
        process.exit(1);
      }
    });

  program
    .command('last')
    .description('Show last recording info')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const latestLink = join(outputDir, 'latest');

        if (!existsSync(latestLink)) {
          console.log('No recordings found.');
          return;
        }

        const resolvedDir = await realpath(latestLink);
        const entries = await readdir(resolvedDir);
        console.log('Last recording:');
        console.log(`  Directory: ${resolvedDir}`);

        for (const entry of entries) {
          const reportPath = join(resolvedDir, entry, 'report.json');
          if (existsSync(reportPath)) {
            const report = JSON.parse(await readFile(reportPath, 'utf-8'));
            console.log(`  Scenario: ${report.scenario}`);
            console.log(`    Status: ${report.overall_status}`);
            console.log(`    Frames: ${report.total_frames_analyzed}`);
            console.log(`    Bugs: ${report.bugs_found}`);
            console.log(`    Duration: ${report.duration_seconds?.toFixed(1)}s`);
          }
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('init')
    .description('Generate a demo-recorder.yaml template in the current directory')
    .option('--from-existing', 'Scan project to auto-detect settings')
    .option('--browser', 'Generate a browser recording template')
    .action(async (opts: { fromExisting?: boolean; browser?: boolean }) => {
      const targetPath = resolve(process.cwd(), 'demo-recorder.yaml');
      if (existsSync(targetPath)) {
        console.error('demo-recorder.yaml already exists in this directory.');
        process.exit(1);
      }

      let template: string;

      if (opts.browser) {
        template = getBrowserTemplate();
        console.log('✓ Created demo-recorder.yaml (browser recording template)');
      } else if (opts.fromExisting) {
        const info = await scanProject(process.cwd());
        template = generateConfig(info);
        console.log(`✓ Detected ${info.type} project: ${info.name}`);
      } else {
        template = getTerminalTemplate();
      }

      await writeFile(targetPath, template, 'utf-8');
      if (!opts.browser && !opts.fromExisting) {
        console.log('✓ Created demo-recorder.yaml');
      }
      console.log('  Edit the file to configure your project and scenarios.');
    });

  program
    .command('diff')
    .description('Compare two recording reports for regressions')
    .argument('<baseline>', 'Path to baseline report.json')
    .argument('<current>', 'Path to current report.json')
    .option('-q, --quiet', 'Only output exit code (1 if regressions)')
    .action(async (baselinePath: string, currentPath: string, opts: { quiet?: boolean }) => {
      try {
        const result = await detectRegressions(
          resolve(process.cwd(), baselinePath),
          resolve(process.cwd(), currentPath),
        );

        if (!opts.quiet) {
          console.log(`Regression report: ${result.scenario}`);
          console.log(`  Baseline: ${result.baseline_timestamp}`);
          console.log(`  Current:  ${result.current_timestamp}`);
          console.log('');

          if (result.changes.length === 0) {
            console.log('  No changes detected.');
          } else {
            for (const change of result.changes) {
              const icon = change.severity === 'critical' ? '✗' : change.severity === 'warning' ? '!' : '✓';
              console.log(`  ${icon} [${change.severity.toUpperCase()}] ${change.description}`);
            }
          }

          console.log('');
          console.log(`Summary: ${result.summary}`);
        }

        if (result.has_regressions) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('watch')
    .description('Watch project files and auto-record on change')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-s, --scenario <name>', 'Limit to a specific scenario')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        const projectDir = process.cwd();
        const scenario = opts.scenario ? findScenario(config, opts.scenario) : undefined;

        const handle = startWatcher({ config, projectDir, scenario });

        process.on('SIGINT', () => {
          handle.close();
          process.exit(0);
        });
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('serve')
    .description('Start MCP server for agent integration')
    .action(async () => {
      try {
        await startMcpServer();
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('themes')
    .description('List available VHS recording themes')
    .option('--category <cat>', 'Filter by category: dark or light')
    .action((opts: { category?: string }) => {
      const filtered = opts.category
        ? VHS_THEMES.filter((t) => t.category === opts.category)
        : VHS_THEMES;

      if (filtered.length === 0) {
        console.log(`No themes found for category: ${opts.category}`);
        return;
      }

      const darkThemes = filtered.filter((t) => t.category === 'dark');
      const lightThemes = filtered.filter((t) => t.category === 'light');

      if (darkThemes.length > 0) {
        console.log('Dark Themes:');
        for (const t of darkThemes) {
          console.log(`  ${t.name.padEnd(24)} ${t.description}`);
        }
      }

      if (lightThemes.length > 0) {
        if (darkThemes.length > 0) console.log('');
        console.log('Light Themes:');
        for (const t of lightThemes) {
          console.log(`  ${t.name.padEnd(24)} ${t.description}`);
        }
      }

      console.log('');
      console.log(`Total: ${filtered.length} themes`);
      console.log('Usage: demo-recorder record --theme "Dracula"');
    });

  program
    .command('stats')
    .description('Show recording statistics and quality trends')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const stats = await computeStats(outputDir);
        console.log(formatStats(stats));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('session-diff')
    .description('Compare two recording sessions')
    .argument('<sessionA>', 'Session A timestamp (e.g., 2026-04-11_08-00)')
    .argument('<sessionB>', 'Session B timestamp (e.g., 2026-04-11_09-00)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (sessionA: string, sessionB: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const resolvedA = resolveSessionPath(outputDir, sessionA);
        const resolvedB = resolveSessionPath(outputDir, sessionB);
        const result = await diffSessions(outputDir, resolvedA, resolvedB);
        console.log(formatSessionDiff(result));

        if (result.regressed > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('export')
    .description('Export a recording session as a zip or tar.gz archive')
    .argument('<session>', 'Session timestamp (e.g., 2026-04-11_08-00)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-f, --format <format>', 'Archive format: tar or zip', 'tar')
    .option('-o, --output <dir>', 'Output directory for the archive')
    .action(async (session: string, opts: { config?: string; format?: string; output?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const resolvedSession = resolveSessionPath(outputDir, session);
        const sessionDir = join(outputDir, resolvedSession);

        if (!existsSync(sessionDir)) {
          throw new Error(`Session directory not found: ${sessionDir}`);
        }

        const artifacts = await listSessionArtifacts(sessionDir);
        console.log(`Exporting session "${session}":`);
        console.log(`  Scenarios: ${artifacts.directories.length}`);
        console.log(`  Files: ${artifacts.files.length}`);

        const archiveFormat = opts.format === 'zip' ? 'zip' : 'tar' as const;
        const archiveOutputDir = opts.output ? resolve(process.cwd(), opts.output) : outputDir;

        const result = await createArchive(sessionDir, archiveOutputDir, archiveFormat);
        console.log(`\n✓ Archive created: ${result.outputPath}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('changelog')
    .description('Generate a changelog from recording history')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const sessions = await loadChangelogSessions(outputDir);

        if (sessions.length === 0) {
          console.log('No recording sessions found.');
          return;
        }

        const changelogEntries = generateChangelog(sessions);
        console.log(formatChangelog(changelogEntries));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('replay')
    .description('Replay a recorded session step-by-step')
    .argument('<path>', 'Path to scenario directory (e.g., 2026-04-11_08-00/basic)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--auto', 'Auto-play without pausing')
    .option('--speed <multiplier>', 'Playback speed multiplier (default: 1)', '1')
    .action(async (replayPath: string, opts: { config?: string; auto?: boolean; speed?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const resolvedPath = resolveSessionPath(outputDir, replayPath);
        const scenarioDir = join(outputDir, resolvedPath);
        const reportPath = join(scenarioDir, 'report.json');

        if (!existsSync(reportPath)) {
          throw new Error(`Report not found: ${reportPath}`);
        }

        const report = JSON.parse(await readFile(reportPath, 'utf-8'));
        const plan = buildReplayPlan(report);

        console.log(formatReplayHeader(plan));

        if (plan.steps.length === 0) {
          console.log('No frames to replay.');
          return;
        }

        const speed = parseFloat(opts.speed ?? '1') || 1;

        for (const step of plan.steps) {
          if (opts.auto && step.delayMs > 0) {
            await new Promise((r) => setTimeout(r, step.delayMs / speed));
          }
          console.log(formatReplayStep(step, plan.totalSteps));
          console.log('');
        }

        console.log(`[Replay complete] ${plan.scenarioName} — ${plan.bugsFound} bug(s) found`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('profiles')
    .description('List available recording profiles')
    .option('-c, --config <path>', 'Config file path (to show custom profiles)')
    .action(async (opts: { config?: string }) => {
      let customProfiles: import('./config/profiles.js').RecordingProfile[] = [];
      if (opts.config) {
        try {
          const loaded = await loadConfig(opts.config);
          customProfiles = parseCustomProfiles((loaded as any).profiles);
        } catch { /* ignore config load errors */ }
      } else {
        try {
          const loaded = await loadConfig();
          customProfiles = parseCustomProfiles((loaded as any).profiles);
        } catch { /* no config file, show built-in only */ }
      }

      const allProfiles = getAllProfiles(customProfiles);
      const customNames = new Set(customProfiles.map((p) => p.name.toLowerCase()));

      console.log('Available Recording Profiles:\n');
      for (const profile of allProfiles) {
        const label = customNames.has(profile.name.toLowerCase()) ? ' (custom)' : '';
        console.log(`  ${profile.name.padEnd(16)} ${profile.description}${label}`);
        const rec = profile.recording;
        const details: string[] = [];
        if (rec.width && rec.height) details.push(`${rec.width}x${rec.height}`);
        if (rec.format) details.push(`${rec.format}`);
        if (rec.fps) details.push(`${rec.fps}fps`);
        if (rec.theme) details.push(`${rec.theme}`);
        if (details.length > 0) {
          console.log(`  ${''.padEnd(16)} ${details.join(', ')}`);
        }
        console.log('');
      }
      console.log('Usage: demo-recorder record --profile ci');
    });

  // Register extracted commands (analyze, env, migrate, prune, ci, doctor, baseline, schema, languages)
  registerCommands(program);

  return program;
}

