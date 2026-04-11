import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from './config/loader.js';
import { lintConfig, formatLintReport } from './config/linter.js';
import { runPreflightChecks, formatPreflightReport } from './config/preflight.js';
import { mergeConfigs, formatMergeReport } from './config/config-merge.js';
import { formatDependencyGraph } from './config/dependencies.js';
import { listScaffolds, findScaffold, listScaffoldsByCategory, formatScaffoldList } from './config/scaffold.js';
import { diagnoseConfig, formatDoctorResult } from './config/config-doctor.js';
import { exportConfig, formatExportSummary } from './config/config-export.js';

/**
 * Register config tool CLI commands onto the given program.
 *
 * Split from cli-config-commands.ts to keep files under 500 lines.
 * Commands: lint, check, config-merge, graph, scaffold, diagnose, config-export.
 */
export function registerConfigToolCommands(program: Command): void {
  registerLintCommand(program);
  registerCheckCommand(program);
  registerMergeCommand(program);
  registerGraphCommand(program);
  registerScaffoldCommand(program);
  registerDiagnoseCommand(program);
  registerConfigExportCommand(program);
}

function registerLintCommand(program: Command): void {
  program
    .command('lint')
    .description('Run best-practice checks on config')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const result = lintConfig(config);
        console.log(formatLintReport(result));
        if (!result.passed) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerCheckCommand(program: Command): void {
  program
    .command('check')
    .description('Run pre-flight checks (validation + lint + health)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--backend <backend>', 'Check for specific backend: vhs or browser', 'vhs')
    .action(async (opts: { config?: string; backend: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const result = await runPreflightChecks(config, process.cwd(), opts.backend as 'vhs' | 'browser');
        console.log(formatPreflightReport(result));
        if (!result.passed) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerMergeCommand(program: Command): void {
  program
    .command('config-merge')
    .description('Deep-merge two config files (base + override)')
    .argument('<base>', 'Path to base config file')
    .argument('<override>', 'Path to override config file')
    .option('-o, --output <path>', 'Write merged config to file')
    .option('--json', 'Output as JSON instead of YAML')
    .action(async (basePath: string, overridePath: string, opts: { output?: string; json?: boolean }) => {
      try {
        const yaml = await import('yaml');
        const resolvedBase = resolve(process.cwd(), basePath);
        const resolvedOverride = resolve(process.cwd(), overridePath);

        if (!existsSync(resolvedBase)) {
          throw new Error(`Base config not found: ${resolvedBase}`);
        }
        if (!existsSync(resolvedOverride)) {
          throw new Error(`Override config not found: ${resolvedOverride}`);
        }

        const baseContent = yaml.parse(await readFile(resolvedBase, 'utf-8')) as Record<string, unknown>;
        const overrideContent = yaml.parse(await readFile(resolvedOverride, 'utf-8')) as Record<string, unknown>;
        const result = mergeConfigs(baseContent, overrideContent);

        if (opts.output) {
          const outputPath = resolve(process.cwd(), opts.output);
          const content = opts.json
            ? JSON.stringify(result.merged, null, 2)
            : yaml.stringify(result.merged);
          await writeFile(outputPath, content, 'utf-8');
          console.log(`✓ Merged config written to ${outputPath}`);
        } else {
          console.log(formatMergeReport(result));
          console.log('');
          if (opts.json) {
            console.log(JSON.stringify(result.merged, null, 2));
          } else {
            console.log(yaml.stringify(result.merged));
          }
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerGraphCommand(program: Command): void {
  program
    .command('graph')
    .description('Show scenario dependency graph')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const allScenarios = [
          ...config.scenarios.map((s) => ({ name: s.name, depends_on: s.depends_on })),
          ...config.browser_scenarios.map((s) => ({ name: s.name, depends_on: s.depends_on })),
        ];
        console.log(formatDependencyGraph(allScenarios));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerScaffoldCommand(program: Command): void {
  program
    .command('scaffold')
    .description('Generate a starter config file from a template')
    .argument('[id]', 'Scaffold ID (e.g., cli-basic, web-app)')
    .option('--category <category>', 'Filter scaffolds by category')
    .option('-o, --output <path>', 'Output file path (default: demo-recorder.yaml)')
    .action(async (id: string | undefined, opts: { category?: string; output?: string }) => {
      try {
        // If no ID given, list available scaffolds
        if (!id) {
          const scaffolds = opts.category
            ? listScaffoldsByCategory(opts.category)
            : listScaffolds();
          console.log(formatScaffoldList(scaffolds));
          return;
        }

        const scaffold = findScaffold(id);
        if (!scaffold) {
          console.error(`Unknown scaffold: "${id}". Use "demo-recorder scaffold" to see available options.`);
          process.exit(1);
        }

        const outputPath = opts.output ?? 'demo-recorder.yaml';
        if (existsSync(outputPath)) {
          console.error(`File already exists: ${outputPath}. Use -o to specify a different path.`);
          process.exit(1);
        }

        await writeFile(outputPath, scaffold.yaml, 'utf-8');
        console.log(`✓ Created ${outputPath} from scaffold "${scaffold.name}"`);
        console.log(`  Category: ${scaffold.category}`);
        console.log(`  Description: ${scaffold.description}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDiagnoseCommand(program: Command): void {
  program
    .command('diagnose')
    .description('Diagnose common config problems (dependencies, performance, best practices)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const result = diagnoseConfig(config);
        console.log(formatDoctorResult(result));
        if (!result.passed) process.exit(1);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerConfigExportCommand(program: Command): void {
  program
    .command('config-export')
    .description('Export parsed config as JSON or TOML')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-f, --format <format>', 'Output format (json, toml)', 'json')
    .option('-o, --output <path>', 'Write to file instead of stdout')
    .action(async (opts: { config?: string; format?: string; output?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const format = (opts.format === 'toml' ? 'toml' : 'json') as 'json' | 'toml';
        const result = exportConfig(config, format);

        if (opts.output) {
          await writeFile(opts.output, result.content, 'utf-8');
          console.log(formatExportSummary(result));
          console.log(`Written to: ${opts.output}`);
        } else {
          console.log(result.content);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
