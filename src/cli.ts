import { Command } from 'commander';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadConfig, findScenario } from './config/loader.js';
import { buildAdhocConfig, buildAdhocScenario } from './config/adhoc.js';
import { scanProject, generateConfig } from './config/scanner.js';
import { record, recordBrowser, writeSessionReport, formatTimestamp } from './index.js';
import { startMcpServer } from './mcp/server.js';
import { detectRegressions } from './pipeline/regression.js';
import { startWatcher } from './pipeline/watcher.js';
import { VHS_THEMES, findTheme, resolveThemeId } from './config/themes.js';
import { computeStats, formatStats } from './analytics/stats.js';
import { diffSessions, formatSessionDiff } from './analytics/diff.js';
import type { Step, BrowserScenario } from './config/schema.js';
import type { Logger } from './pipeline/annotator.js';

const noopLogger: Logger = { log: () => {}, warn: () => {} };

export function createCli(): Command {
  const program = new Command();

  program
    .name('demo-recorder')
    .description('On-demand terminal & browser demo recording + AI annotation CLI tool')
    .version('0.1.0');

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
    .action(async (opts) => {
      try {
        const logger = opts.quiet ? noopLogger : undefined;

        if (opts.adhoc) {
          await handleAdhocRecord(opts, logger);
          return;
        }

        const loaded = await loadConfig(opts.config);
        const config = {
          ...loaded,
          annotation: {
            ...loaded.annotation,
            ...(opts.annotate === false && { enabled: false }),
          },
          recording: {
            ...loaded.recording,
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

        if (backend === 'browser') {
          await handleBrowserRecord(config, opts.scenario, projectDir, logger, opts.quiet, opts.tag);
        } else {
          await handleVhsRecord(config, opts.scenario, projectDir, logger, opts.quiet, opts.tag);
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
    .description('Validate config file')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        console.log('✓ Config valid');
        console.log(`  Project: ${config.project.name}`);
        console.log(`  Terminal Scenarios: ${config.scenarios.length}`);
        console.log(`  Browser Scenarios: ${config.browser_scenarios.length}`);
        console.log(`  Recording: ${config.recording.width}x${config.recording.height} (${config.recording.backend})`);
        console.log(`  Annotation: ${config.annotation.enabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error(`✗ Config invalid: ${error instanceof Error ? error.message : error}`);
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
        const result = await diffSessions(outputDir, sessionA, sessionB);
        console.log(formatSessionDiff(result));

        if (result.regressed > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  return program;
}

async function handleVhsRecord(
  config: ReturnType<typeof Object>,
  scenarioName: string | undefined,
  projectDir: string,
  logger: Logger | undefined,
  quiet: boolean | undefined,
  tag?: string,
) {
  let scenarios = scenarioName
    ? [findScenario(config as any, scenarioName)]
    : (config as any).scenarios;

  if (tag) {
    scenarios = filterByTag(scenarios, tag);
    if (scenarios.length === 0) {
      throw new Error(`No scenarios match tag "${tag}"`);
    }
  }

  const timestamp = formatTimestamp(new Date());
  const results = [];
  for (const scenario of scenarios) {
    const result = await record({ config: config as any, scenario, projectDir, logger, timestamp });
    results.push(result);
    if (!quiet) console.log('');
  }

  if (results.length > 1) {
    const sessionDir = dirname(dirname(results[0].reportPath));
    const sessionPath = join(sessionDir, 'session-report.json');
    const reports = await Promise.all(
      results.map(async (r) => JSON.parse(await readFile(r.reportPath, 'utf-8'))),
    );
    await writeSessionReport(sessionPath, (config as any).project.name, reports);
    if (!quiet) console.log(`Session report: ${sessionPath}`);
  }
}

async function handleBrowserRecord(
  config: ReturnType<typeof Object>,
  scenarioName: string | undefined,
  projectDir: string,
  logger: Logger | undefined,
  quiet: boolean | undefined,
  tag?: string,
) {
  let browserScenarios: BrowserScenario[] = scenarioName
    ? [(config as any).browser_scenarios.find((s: BrowserScenario) => s.name === scenarioName)]
    : (config as any).browser_scenarios;

  if (scenarioName && !browserScenarios[0]) {
    throw new Error(`Browser scenario "${scenarioName}" not found`);
  }

  if (tag) {
    browserScenarios = filterByTag(browserScenarios, tag);
    if (browserScenarios.length === 0) {
      throw new Error(`No browser scenarios match tag "${tag}"`);
    }
  }

  const timestamp = formatTimestamp(new Date());
  const results = [];
  for (const scenario of browserScenarios) {
    const result = await recordBrowser({ config: config as any, scenario, projectDir, logger, timestamp });
    results.push(result);
    if (!quiet) console.log('');
  }

  if (results.length > 1) {
    const sessionDir = dirname(dirname(results[0].reportPath));
    const sessionPath = join(sessionDir, 'session-report.json');
    const reports = await Promise.all(
      results.map(async (r) => JSON.parse(await readFile(r.reportPath, 'utf-8'))),
    );
    await writeSessionReport(sessionPath, (config as any).project.name, reports);
    if (!quiet) console.log(`Session report: ${sessionPath}`);
  }
}

/**
 * Filter scenarios by tag. Supports negation with "!" prefix.
 * @param scenarios - Array of scenarios with optional `tags` field.
 * @param tag - Tag to filter by. Prefix with "!" to exclude.
 * @returns Filtered scenarios.
 */
export function filterByTag<T extends { tags?: string[] }>(scenarios: T[], tag: string): T[] {
  if (tag.startsWith('!')) {
    const excludeTag = tag.slice(1).toLowerCase();
    return scenarios.filter((s) => !(s.tags ?? []).some((t) => t.toLowerCase() === excludeTag));
  }
  const includeTag = tag.toLowerCase();
  return scenarios.filter((s) => (s.tags ?? []).some((t) => t.toLowerCase() === includeTag));
}

function parseAdhocSteps(stepsStr: string): Step[] {
  return stepsStr.split(',').map((token) => {
    const trimmed = token.trim();
    if (trimmed.startsWith('sleep:')) {
      return { action: 'sleep' as const, value: trimmed.slice(6), pause: '0ms' };
    }
    if (['enter', 'tab', 'escape', 'esc', 'backspace', 'up', 'down', 'left', 'right', 'space'].includes(trimmed.toLowerCase())) {
      return { action: 'key' as const, value: trimmed, pause: '500ms' };
    }
    if (trimmed.length === 1) {
      return { action: 'key' as const, value: trimmed, pause: '500ms' };
    }
    return { action: 'type' as const, value: trimmed, pause: '500ms' };
  });
}

async function handleAdhocRecord(opts: {
  command?: string;
  url?: string;
  steps?: string;
  width: string;
  height: string;
  format: string;
  annotate: boolean;
  backend?: string;
  theme?: string;
}, logger?: Logger): Promise<void> {
  if (opts.backend === 'browser') {
    await handleAdhocBrowserRecord(opts, logger);
    return;
  }

  if (!opts.command) {
    throw new Error('--command is required with --adhoc mode');
  }

  const parsedSteps = opts.steps ? parseAdhocSteps(opts.steps) : undefined;
  const config = buildAdhocConfig({
    command: opts.command,
    steps: parsedSteps,
    width: parseInt(opts.width, 10),
    height: parseInt(opts.height, 10),
    format: opts.format === 'gif' ? 'gif' : 'mp4',
    annotate: opts.annotate,
    theme: opts.theme,
  });
  const scenario = buildAdhocScenario(opts.command, parsedSteps);

  await record({ config, scenario, projectDir: process.cwd(), logger });
}

async function handleAdhocBrowserRecord(opts: {
  url?: string;
  steps?: string;
  width: string;
  height: string;
  annotate: boolean;
  theme?: string;
}, logger?: Logger): Promise<void> {
  if (!opts.url) {
    throw new Error('--url is required with --adhoc --backend browser mode');
  }

  const config = buildAdhocConfig({
    command: opts.url,
    width: parseInt(opts.width, 10),
    height: parseInt(opts.height, 10),
    format: 'mp4',
    annotate: opts.annotate,
    backend: 'browser',
    theme: opts.theme,
  });

  const browserSteps = opts.steps
    ? parseAdhocBrowserSteps(opts.steps)
    : [];

  const scenario: BrowserScenario = {
    name: 'adhoc-browser',
    description: `Ad-hoc browser recording: ${opts.url}`,
    url: opts.url,
    setup: [],
    steps: browserSteps,
    tags: [],
  };

  await recordBrowser({ config, scenario, projectDir: process.cwd(), logger });
}

function parseAdhocBrowserSteps(stepsStr: string): BrowserScenario['steps'] {
  return stepsStr.split(',').map((token) => {
    const trimmed = token.trim();
    if (trimmed.startsWith('sleep:')) {
      return { action: 'sleep' as const, value: trimmed.slice(6), pause: '0ms' };
    }
    if (trimmed.startsWith('click:')) {
      return { action: 'click' as const, value: trimmed.slice(6), pause: '500ms' };
    }
    if (trimmed.startsWith('fill:')) {
      const parts = trimmed.slice(5).split('=');
      return { action: 'fill' as const, value: parts[0], text: parts.slice(1).join('='), pause: '500ms' };
    }
    if (trimmed.startsWith('nav:')) {
      return { action: 'navigate' as const, value: trimmed.slice(4), pause: '1000ms' };
    }
    if (trimmed.startsWith('scroll:')) {
      return { action: 'scroll' as const, value: trimmed.slice(7), pause: '500ms' };
    }
    if (trimmed.startsWith('wait:')) {
      return { action: 'wait' as const, value: trimmed.slice(5), pause: '500ms' };
    }
    // Default: type the text
    return { action: 'type' as const, value: trimmed, pause: '500ms' };
  });
}

/**
 * Format a dry-run plan summary for a scenario.
 * Exported for testing.
 */
export function formatDryRun(
  scenario: { name: string; description: string; steps: { action: string }[]; hooks?: { before?: string; after?: string }; url?: string },
  config: any,
  backend: 'vhs' | 'browser',
): string {
  const lines: string[] = [];
  const timestamp = formatTimestamp(new Date());
  const outputDir = resolve(process.cwd(), config.output.dir, timestamp, scenario.name);

  lines.push(`[DRY RUN] Would record scenario "${scenario.name}":`);
  lines.push(`  Backend: ${backend}`);

  if (backend === 'browser' && scenario.url) {
    lines.push(`  URL: ${scenario.url}`);
  }

  lines.push(`  Format: ${config.recording.formats?.join(', ') ?? config.recording.format ?? 'mp4'}`);
  lines.push(`  Theme: ${config.recording.theme}`);

  // Summarize steps by action type
  const actionCounts = new Map<string, number>();
  for (const step of scenario.steps) {
    actionCounts.set(step.action, (actionCounts.get(step.action) ?? 0) + 1);
  }
  const stepSummary = [...actionCounts.entries()]
    .map(([action, count]) => `${action} x${count}`)
    .join(', ');
  lines.push(`  Steps: ${scenario.steps.length} (${stepSummary})`);

  lines.push(`  Output: ${outputDir}/`);
  lines.push(`  Annotation: ${config.annotation.enabled ? `enabled (${config.annotation.model})` : 'disabled'}`);

  if (scenario.hooks?.before || scenario.hooks?.after) {
    const hookParts: string[] = [];
    if (scenario.hooks.before) hookParts.push(`before: "${scenario.hooks.before}"`);
    if (scenario.hooks.after) hookParts.push(`after: "${scenario.hooks.after}"`);
    lines.push(`  Hooks: ${hookParts.join(', ')}`);
  }

  return lines.join('\n');
}

function getTerminalTemplate(): string {
  return `project:
  name: my-project
  description: "My CLI/TUI project"
  # build_command: "make build"
  # binary: "./my-project"

recording:
  width: 1200
  height: 800
  font_size: 16
  theme: "Catppuccin Mocha"
  fps: 25
  max_duration: 60
  # format: "mp4"  # or "gif"

output:
  dir: ".demo-recordings"
  keep_raw: true
  keep_frames: false

annotation:
  enabled: true
  model: "claude-sonnet-4-6"
  extract_fps: 1
  language: "en"
  overlay_position: "bottom"
  overlay_font_size: 14

scenarios:
  - name: "basic"
    description: "Basic interaction demo"
    setup: []
    steps:
      - { action: "type", value: "./my-project", pause: "2s" }
      - { action: "key", value: "q", pause: "500ms" }
`;
}

function getBrowserTemplate(): string {
  return `project:
  name: my-web-app
  description: "My web application"
  # build_command: "npm run build"

recording:
  backend: browser
  browser:
    headless: true
    browser: chromium
    viewport_width: 1280
    viewport_height: 720
    timeout_ms: 30000
    device_scale_factor: 1
    record_video: true

output:
  dir: ".demo-recordings"
  keep_raw: true
  keep_frames: false

annotation:
  enabled: true
  model: "claude-sonnet-4-6"
  extract_fps: 1
  language: "en"
  overlay_position: "bottom"
  overlay_font_size: 14

browser_scenarios:
  - name: "homepage"
    description: "Navigate the homepage"
    url: "http://localhost:3000"
    steps:
      - { action: "sleep", value: "2s" }
      - { action: "click", value: "nav a:first-child", pause: "1s" }
      - { action: "scroll", value: "300", pause: "1s" }
      - { action: "screenshot", value: "homepage.png" }
`;
}
