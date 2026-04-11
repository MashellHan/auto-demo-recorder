import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig } from './config/loader.js';
import { cloneScenario, cloneBrowserScenario, formatCloneSummary } from './config/scenario-clone.js';
import { interpolateConfig, listConfigVariables, formatInterpolationResult } from './config/interpolation.js';
import { compareConfigs, formatComparisonReport } from './config/config-comparison.js';
import { analyzeDependencyDepth, formatDepthAnalysis } from './config/dependency-depth.js';
import { scoreComplexity, formatComplexity } from './analytics/complexity.js';
import { checkDependencyHealth, formatDepHealth } from './config/dep-health.js';

/**
 * Register config analysis CLI commands onto the given program.
 *
 * Split from cli-config-tools-commands.ts to keep files under 400 lines.
 * Commands: clone, interpolate, config-compare, depth, complexity, dep-health.
 */
export function registerConfigAnalysisCommands(program: Command): void {
  registerCloneCommand(program);
  registerInterpolateCommand(program);
  registerConfigCompareCommand(program);
  registerDepthAnalysisCommand(program);
  registerComplexityCommand(program);
  registerDepHealthCommand(program);
}

function registerCloneCommand(program: Command): void {
  program
    .command('clone')
    .description('Clone a scenario with optional overrides')
    .argument('<scenario>', 'Source scenario name to clone')
    .argument('<newName>', 'Name for the cloned scenario')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--description <desc>', 'Description for the clone')
    .option('--tags <tags>', 'Comma-separated tags for the clone')
    .option('--url <url>', 'Override URL (browser scenarios only)')
    .action(async (scenario: string, newName: string, opts: { config?: string; description?: string; tags?: string; url?: string }) => {
      try {
        const config = await loadConfig(opts.config);

        const terminalSource = config.scenarios.find((s) => s.name === scenario);
        const browserSource = config.browser_scenarios.find((s) => s.name === scenario);
        const source = terminalSource ?? browserSource;

        if (!source) {
          throw new Error(`Scenario "${scenario}" not found. Use "demo-recorder list" to see available scenarios.`);
        }

        const cloneOpts = {
          name: newName,
          description: opts.description,
          tags: opts.tags ? opts.tags.split(',').map((t) => t.trim()) : undefined,
        };

        const cloned = browserSource
          ? cloneBrowserScenario(browserSource, { ...cloneOpts, url: opts.url })
          : cloneScenario(terminalSource!, cloneOpts);

        console.log(formatCloneSummary(scenario, [cloned]));
        console.log('');
        console.log('Note: Clone is generated in memory. Add it to your config file to persist.');
        console.log('');
        const yaml = await import('yaml');
        console.log(yaml.stringify({ scenarios: [cloned] }));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerInterpolateCommand(program: Command): void {
  program
    .command('interpolate')
    .description('Show config variable interpolation (${VAR} substitution)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--list', 'List all variable references without resolving')
    .action(async (opts: { config?: string; list?: boolean }) => {
      try {
        const configPath = resolve(process.cwd(), opts.config ?? 'demo-recorder.yaml');
        if (!existsSync(configPath)) {
          throw new Error(`Config file not found: ${configPath}`);
        }

        const yaml = await import('yaml');
        const raw = yaml.parse(await readFile(configPath, 'utf-8')) as Record<string, unknown>;

        if (opts.list) {
          const vars = listConfigVariables(raw);
          if (vars.length === 0) {
            console.log('No variable references found in config.');
          } else {
            console.log('Variable references in config:\n');
            for (const v of vars) {
              const envVal = process.env[v];
              const status = envVal !== undefined ? `= "${envVal}"` : '(not set)';
              console.log(`  \${${v}} ${status}`);
            }
            console.log(`\nTotal: ${vars.length} variable(s)`);
          }
          return;
        }

        const result = interpolateConfig(raw, process.env, false);
        console.log(formatInterpolationResult(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerConfigCompareCommand(program: Command): void {
  program
    .command('config-compare')
    .description('Compare two config files and show structural differences')
    .argument('<fileA>', 'Path to first config file')
    .argument('<fileB>', 'Path to second config file')
    .action(async (fileA: string, fileB: string) => {
      try {
        const yaml = await import('yaml');
        const { ConfigSchema } = await import('./config/schema.js');
        const resolvedA = resolve(process.cwd(), fileA);
        const resolvedB = resolve(process.cwd(), fileB);

        if (!existsSync(resolvedA)) {
          throw new Error(`Config file not found: ${resolvedA}`);
        }
        if (!existsSync(resolvedB)) {
          throw new Error(`Config file not found: ${resolvedB}`);
        }

        const rawA = yaml.parse(await readFile(resolvedA, 'utf-8'));
        const rawB = yaml.parse(await readFile(resolvedB, 'utf-8'));
        const configA = ConfigSchema.parse(rawA);
        const configB = ConfigSchema.parse(rawB);
        const report = compareConfigs(configA, configB);
        console.log(formatComparisonReport(report));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDepthAnalysisCommand(program: Command): void {
  program
    .command('depth')
    .description('Analyze scenario dependency depth and critical paths')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const allScenarios = [
          ...config.scenarios.map((s) => ({ name: s.name, depends_on: s.depends_on })),
          ...config.browser_scenarios.map((s) => ({ name: s.name, depends_on: s.depends_on })),
        ];
        const result = analyzeDependencyDepth(allScenarios);
        console.log(formatDepthAnalysis(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerComplexityCommand(program: Command): void {
  program
    .command('complexity')
    .description('Score scenario complexity with refactoring recommendations')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const allScenarios = [
          ...config.scenarios,
          ...config.browser_scenarios,
        ];
        const result = scoreComplexity(allScenarios);
        console.log(formatComplexity(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDepHealthCommand(program: Command): void {
  program
    .command('dep-health')
    .description('Check dependency graph health (cycles, depth, fan-out/in)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const allScenarios = [
          ...config.scenarios,
          ...config.browser_scenarios,
        ];
        const result = checkDependencyHealth(allScenarios);
        console.log(formatDepHealth(result));
        if (!result.healthy) process.exit(1);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
