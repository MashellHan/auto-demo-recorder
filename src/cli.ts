import { Command } from 'commander';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadConfig, findScenario } from './config/loader.js';
import { buildAdhocConfig, buildAdhocScenario } from './config/adhoc.js';
import { record } from './index.js';
import { startMcpServer } from './mcp/server.js';
import { detectRegressions } from './pipeline/regression.js';
import type { Step } from './config/schema.js';
import type { Logger } from './pipeline/annotator.js';

const noopLogger: Logger = { log: () => {}, warn: () => {} };

export function createCli(): Command {
  const program = new Command();

  program
    .name('demo-recorder')
    .description('On-demand terminal demo recording + AI annotation CLI tool')
    .version('0.1.0');

  program
    .command('record')
    .description('Record a demo video')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-s, --scenario <name>', 'Scenario name to record')
    .option('--no-annotate', 'Skip AI annotation')
    .option('--format <format>', 'Output format: mp4 or gif', 'mp4')
    .option('-q, --quiet', 'Suppress progress output')
    .option('--adhoc', 'Ad-hoc recording mode (no config file needed)')
    .option('--command <cmd>', 'Command to run (used with --adhoc)')
    .option('--steps <steps>', 'Comma-separated steps: j,k,Enter,sleep:2s,q (used with --adhoc)')
    .option('--width <n>', 'Terminal width (used with --adhoc)', '1200')
    .option('--height <n>', 'Terminal height (used with --adhoc)', '800')
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
          },
        };

        const projectDir = process.cwd();
        const scenarios = opts.scenario
          ? [findScenario(config, opts.scenario)]
          : config.scenarios;

        for (const scenario of scenarios) {
          await record({ config, scenario, projectDir, logger });
          if (!opts.quiet) console.log('');
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
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        console.log(`Project: ${config.project.name}`);
        console.log(`Scenarios:`);
        for (const s of config.scenarios) {
          console.log(`  - ${s.name}: ${s.description}`);
          console.log(`    Steps: ${s.steps.length}, Setup: ${s.setup.length} commands`);
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
        console.log('\u2713 Config valid');
        console.log(`  Project: ${config.project.name}`);
        console.log(`  Scenarios: ${config.scenarios.length}`);
        console.log(`  Recording: ${config.recording.width}x${config.recording.height}`);
        console.log(`  Annotation: ${config.annotation.enabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error(`\u2717 Config invalid: ${error instanceof Error ? error.message : error}`);
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
    .action(async () => {
      const targetPath = resolve(process.cwd(), 'demo-recorder.yaml');
      if (existsSync(targetPath)) {
        console.error('demo-recorder.yaml already exists in this directory.');
        process.exit(1);
      }

      const template = `project:
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

      await writeFile(targetPath, template, 'utf-8');
      console.log('\u2713 Created demo-recorder.yaml');
      console.log('  Edit the file to configure your project and scenarios.');
    });

  program
    .command('diff')
    .description('Compare two recording reports for regressions')
    .argument('<baseline>', 'Path to baseline report.json')
    .argument('<current>', 'Path to current report.json')
    .action(async (baselinePath: string, currentPath: string) => {
      try {
        const result = await detectRegressions(
          resolve(process.cwd(), baselinePath),
          resolve(process.cwd(), currentPath),
        );

        console.log(`Regression report: ${result.scenario}`);
        console.log(`  Baseline: ${result.baseline_timestamp}`);
        console.log(`  Current:  ${result.current_timestamp}`);
        console.log('');

        if (result.changes.length === 0) {
          console.log('  No changes detected.');
        } else {
          for (const change of result.changes) {
            const icon = change.severity === 'critical' ? '\u2717' : change.severity === 'warning' ? '!' : '\u2713';
            console.log(`  ${icon} [${change.severity.toUpperCase()}] ${change.description}`);
          }
        }

        console.log('');
        console.log(`Summary: ${result.summary}`);

        if (result.has_regressions) {
          process.exit(1);
        }
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

  return program;
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
  steps?: string;
  width: string;
  height: string;
  format: string;
  annotate: boolean;
}, logger?: Logger): Promise<void> {
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
  });
  const scenario = buildAdhocScenario(opts.command, parsedSteps);

  await record({ config, scenario, projectDir: process.cwd(), logger });
}
