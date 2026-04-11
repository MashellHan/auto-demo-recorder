import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from './config/loader.js';
import { captureEnvironmentSnapshot, formatEnvironmentSnapshot } from './pipeline/environment.js';
import { migrateConfig, formatMigrationReport } from './config/migration.js';
import { pruneRecordings, formatPruneReport } from './pipeline/prune.js';
import { generateCIConfig, getSupportedProviders } from './config/ci-generator.js';
import { runHealthCheck, formatHealthCheck } from './pipeline/health-check.js';
import { exportJsonSchema } from './config/schema-export.js';
import { listLanguages } from './config/languages.js';
import { listTemplates, getTemplateCategories } from './config/templates.js';
import { resolveExtendsChain, formatExtendsChain } from './config/extends-resolver.js';
import { generateCompletion, detectShell } from './config/completions.js';
import { PluginRegistry, formatPluginList } from './pipeline/plugin-system.js';
import { listSnapshots, saveSnapshot, restoreSnapshot, formatSnapshotList } from './pipeline/snapshots.js';
import { diffConfigs, formatConfigDiff } from './config/config-diff.js';
import { estimateCost, getEstimateModels, formatCostEstimate } from './analytics/cost-estimator.js';
import { lintConfig, formatLintReport } from './config/linter.js';
import { registerAnalyticsCommands } from './cli-analytics-commands.js';

/**
 * Register all extracted CLI commands onto the given program.
 * Admin/config commands are defined here; analytics commands are in cli-analytics-commands.ts.
 */
export function registerCommands(program: Command): void {
  // Analytics commands (analyze, baseline, metrics, visual-diff, summary, matrix, tag-stats, compare, history)
  registerAnalyticsCommands(program);

  // Admin/config commands
  registerEnvCommand(program);
  registerMigrateCommand(program);
  registerPruneCommand(program);
  registerCiCommand(program);
  registerDoctorCommand(program);
  registerSchemaCommand(program);
  registerLanguagesCommand(program);
  registerTemplatesCommand(program);
  registerExtendsCommand(program);
  registerShowCommand(program);
  registerCompletionCommand(program);
  registerPluginsCommand(program);
  registerSnapshotCommand(program);
  registerDiffCommand(program);
  registerEstimateCommand(program);
  registerLintCommand(program);
}

function registerEnvCommand(program: Command): void {
  program
    .command('env')
    .description('Show environment snapshot (system, tools, project info)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--json', 'Output as JSON')
    .action(async (opts: { config?: string; json?: boolean }) => {
      try {
        const config = await loadConfig(opts.config);
        const projectDir = process.cwd();
        const snapshot = await captureEnvironmentSnapshot(projectDir, config.project.name);

        if (opts.json) {
          console.log(JSON.stringify(snapshot, null, 2));
        } else {
          console.log(formatEnvironmentSnapshot(snapshot));
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Migrate a demo-recorder.yaml to the latest schema version')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--dry-run', 'Show what would change without modifying the file')
    .action(async (opts: { config?: string; dryRun?: boolean }) => {
      try {
        const configPath = resolve(process.cwd(), opts.config ?? 'demo-recorder.yaml');
        if (!existsSync(configPath)) {
          throw new Error(`Config file not found: ${configPath}`);
        }

        const yaml = await import('yaml');
        const raw = yaml.parse(await readFile(configPath, 'utf-8'));
        const result = migrateConfig(raw);

        console.log(formatMigrationReport(result));

        if (result.changed && !opts.dryRun) {
          const migrated = yaml.stringify(result.config);
          await writeFile(configPath, migrated, 'utf-8');
          console.log(`\n✓ Config file updated: ${configPath}`);
        } else if (result.changed && opts.dryRun) {
          console.log('\n[DRY RUN] No changes written to disk.');
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerPruneCommand(program: Command): void {
  program
    .command('prune')
    .description('Remove old recording sessions')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--keep <n>', 'Keep the N most recent sessions')
    .option('--max-age <days>', 'Remove sessions older than N days')
    .option('--dry-run', 'Preview what would be deleted without deleting')
    .action(async (opts: { config?: string; keep?: string; maxAge?: string; dryRun?: boolean }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);

        if (!existsSync(outputDir)) {
          console.log('No recording directory found.');
          return;
        }

        if (!opts.keep && !opts.maxAge) {
          throw new Error('Specify at least --keep <n> or --max-age <days>');
        }

        const result = await pruneRecordings({
          outputDir,
          keepCount: opts.keep ? parseInt(opts.keep, 10) : undefined,
          maxAgeDays: opts.maxAge ? parseInt(opts.maxAge, 10) : undefined,
          dryRun: opts.dryRun,
        });

        console.log(formatPruneReport(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerCiCommand(program: Command): void {
  program
    .command('ci')
    .description('Generate CI/CD configuration for automated recording')
    .option('--provider <provider>', 'CI provider: github, gitlab, or circleci', 'github')
    .option('--branch <branches>', 'Branches to trigger on (comma-separated)', 'main')
    .option('--no-annotate', 'Skip AI annotation in CI')
    .option('--backend <backend>', 'Recording backend: vhs or browser', 'vhs')
    .option('--node-version <version>', 'Node.js version', '22')
    .action(async (opts: { provider: string; branch: string; annotate: boolean; backend: string; nodeVersion: string }) => {
      try {
        const providers = getSupportedProviders();
        if (!providers.includes(opts.provider as any)) {
          throw new Error(`Unsupported provider "${opts.provider}". Supported: ${providers.join(', ')}`);
        }

        const result = generateCIConfig({
          provider: opts.provider as any,
          branches: opts.branch.split(',').map((b) => b.trim()),
          annotate: opts.annotate,
          backend: opts.backend as 'vhs' | 'browser',
          nodeVersion: opts.nodeVersion,
        });

        const targetPath = resolve(process.cwd(), result.filePath);
        const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'));

        if (!existsSync(targetDir)) {
          const { mkdir } = await import('node:fs/promises');
          await mkdir(targetDir, { recursive: true });
        }

        await writeFile(targetPath, result.content, 'utf-8');
        console.log(`✓ ${result.description}`);
        console.log(`  Created: ${result.filePath}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check system health and tool availability')
    .option('--backend <backend>', 'Check for specific backend: vhs or browser', 'vhs')
    .action(async (opts: { backend: string }) => {
      try {
        const result = await runHealthCheck(process.cwd(), opts.backend as 'vhs' | 'browser');
        console.log(formatHealthCheck(result));
        if (!result.allPassed) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerSchemaCommand(program: Command): void {
  program
    .command('schema')
    .description('Export JSON Schema for config file (IDE autocomplete)')
    .option('-o, --output <path>', 'Write schema to file instead of stdout')
    .action(async (opts: { output?: string }) => {
      try {
        const schema = exportJsonSchema();
        const json = JSON.stringify(schema, null, 2);

        if (opts.output) {
          const outputPath = resolve(process.cwd(), opts.output);
          await writeFile(outputPath, json, 'utf-8');
          console.log(`✓ JSON Schema written to ${outputPath}`);
          console.log('  Add to your YAML file: # yaml-language-server: $schema=./schema.json');
        } else {
          console.log(json);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerLanguagesCommand(program: Command): void {
  program
    .command('languages')
    .description('List supported annotation languages')
    .action(() => {
      const languages = listLanguages();
      console.log('Supported Annotation Languages:\n');
      for (const lang of languages) {
        console.log(`  ${lang.code.padEnd(6)} ${lang.name.padEnd(16)} ${lang.nativeName}`);
      }
      console.log('');
      console.log(`Total: ${languages.length} languages`);
      console.log('Usage: Set annotation.language in demo-recorder.yaml');
    });
}

function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .description('List available scenario templates')
    .option('--category <cat>', 'Filter by category')
    .action((opts: { category?: string }) => {
      const templates = listTemplates();
      const categories = getTemplateCategories();

      if (opts.category) {
        const cat = opts.category;
        const filtered = templates.filter((t) => t.category === cat.toLowerCase());
        if (filtered.length === 0) {
          console.log(`No templates found for category: ${cat}`);
          console.log(`Available categories: ${categories.join(', ')}`);
          return;
        }
        console.log(`Templates (${cat}):\n`);
        for (const t of filtered) {
          console.log(`  ${t.id.padEnd(24)} ${t.description}`);
        }
      } else {
        console.log('Available Scenario Templates:\n');
        for (const cat of categories) {
          const catTemplates = templates.filter((t) => t.category === cat);
          console.log(`  ${cat}:`);
          for (const t of catTemplates) {
            console.log(`    ${t.id.padEnd(24)} ${t.description}`);
          }
          console.log('');
        }
      }

      console.log(`Total: ${templates.length} templates`);
      console.log('Usage: Reference template steps in your demo-recorder.yaml');
    });
}

function registerExtendsCommand(program: Command): void {
  program
    .command('extends')
    .description('Show config extends chain resolution')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const configPath = resolve(process.cwd(), opts.config ?? 'demo-recorder.yaml');
        const resolution = await resolveExtendsChain(configPath);
        console.log(formatExtendsChain(resolution));
        if (!resolution.valid) process.exit(1);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerShowCommand(program: Command): void {
  program
    .command('show <scenario>')
    .description('Show detailed information about a scenario')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (scenarioName: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);

        const terminalScenario = config.scenarios.find((s) => s.name === scenarioName);
        const browserScenario = config.browser_scenarios.find((s) => s.name === scenarioName);
        const scenario = terminalScenario ?? browserScenario;

        if (!scenario) {
          throw new Error(`Scenario "${scenarioName}" not found. Use "demo-recorder list" to see available scenarios.`);
        }

        const lines: string[] = [];
        const isBrowser = !!browserScenario;

        lines.push(`Scenario: ${scenario.name}`);
        lines.push('═'.repeat(50));
        lines.push(`  Description: ${scenario.description}`);
        lines.push(`  Backend:     ${isBrowser ? 'browser' : 'vhs'}`);
        if (isBrowser && browserScenario) {
          lines.push(`  URL:         ${browserScenario.url}`);
        }
        lines.push(`  Tags:        ${(scenario.tags ?? []).length > 0 ? scenario.tags!.join(', ') : '(none)'}`);
        lines.push(`  Depends On:  ${(scenario.depends_on ?? []).length > 0 ? scenario.depends_on!.join(', ') : '(none)'}`);

        if (scenario.setup && scenario.setup.length > 0) {
          lines.push('');
          lines.push('Setup Commands:');
          for (const cmd of scenario.setup) {
            lines.push(`  $ ${cmd}`);
          }
        }

        if (scenario.hooks) {
          lines.push('');
          lines.push('Hooks:');
          if (scenario.hooks.before) lines.push(`  Before: ${scenario.hooks.before}`);
          if (scenario.hooks.after) lines.push(`  After:  ${scenario.hooks.after}`);
        }

        lines.push('');
        lines.push(`Steps (${scenario.steps.length}):`);
        for (let i = 0; i < scenario.steps.length; i++) {
          const step = scenario.steps[i];
          const comment = step.comment ? ` — ${step.comment}` : '';
          const repeat = step.repeat && step.repeat > 1 ? ` (×${step.repeat})` : '';
          lines.push(`  ${(i + 1).toString().padStart(2)}. [${step.action}] ${step.value}${repeat}${comment}`);
        }

        console.log(lines.join('\n'));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Generate shell completion script')
    .option('--shell <shell>', 'Shell type: bash, zsh, or fish')
    .action((opts: { shell?: string }) => {
      const shell = (opts.shell ?? detectShell()) as 'bash' | 'zsh' | 'fish';
      if (!['bash', 'zsh', 'fish'].includes(shell)) {
        console.error(`Unsupported shell: ${shell}. Use --shell bash|zsh|fish`);
        process.exit(1);
      }
      console.log(generateCompletion(shell));
    });
}

function registerPluginsCommand(program: Command): void {
  program
    .command('plugins')
    .description('List registered plugins')
    .action(() => {
      const registry = new PluginRegistry();
      console.log(formatPluginList(registry.getPlugins()));
    });
}

function registerSnapshotCommand(program: Command): void {
  const snapshotCmd = program
    .command('snapshot')
    .description('Manage recording session snapshots');

  snapshotCmd
    .command('save <session>')
    .description('Save a snapshot of a recording session')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-l, --label <label>', 'Optional label for the snapshot')
    .action(async (sessionId: string, opts: { config?: string; label?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const result = await saveSnapshot(outputDir, sessionId, opts.label);
        console.log(`✓ Snapshot saved: ${result.snapshot.id}`);
        console.log(`  Files: ${result.filesCopied}`);
        console.log(`  Path: ${result.snapshot.path}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  snapshotCmd
    .command('list <session>')
    .description('List snapshots for a recording session')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (sessionId: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const snapshots = await listSnapshots(outputDir, sessionId);
        console.log(formatSnapshotList(snapshots));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  snapshotCmd
    .command('restore <session> <snapshotId>')
    .description('Restore a session from a snapshot')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (sessionId: string, snapshotId: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const result = await restoreSnapshot(outputDir, sessionId, snapshotId);
        console.log(`✓ Session restored from snapshot`);
        console.log(`  Restored from: ${result.restoredFrom}`);
        console.log(`  Files: ${result.filesRestored}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDiffCommand(program: Command): void {
  program
    .command('config-diff')
    .description('Compare two config files and show differences')
    .argument('<fileA>', 'Path to first config file')
    .argument('<fileB>', 'Path to second config file')
    .option('--json', 'Output as JSON')
    .action(async (fileA: string, fileB: string, opts: { json?: boolean }) => {
      try {
        const yaml = await import('yaml');
        const pathA = resolve(process.cwd(), fileA);
        const pathB = resolve(process.cwd(), fileB);

        if (!existsSync(pathA)) {
          throw new Error(`Config file not found: ${pathA}`);
        }
        if (!existsSync(pathB)) {
          throw new Error(`Config file not found: ${pathB}`);
        }

        const contentA = yaml.parse(await readFile(pathA, 'utf-8')) as Record<string, unknown>;
        const contentB = yaml.parse(await readFile(pathB, 'utf-8')) as Record<string, unknown>;
        const result = diffConfigs(contentA, contentB);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatConfigDiff(result));
        }

        if (!result.identical) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerEstimateCommand(program: Command): void {
  program
    .command('estimate')
    .description('Estimate AI annotation cost for scenarios')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--model <model>', 'AI model for estimation', 'gpt-4o')
    .option('--fps <fps>', 'Frames per second for extraction', '2')
    .action(async (opts: { config?: string; model: string; fps: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const allScenarios = [
          ...config.scenarios.map((s) => ({
            name: s.name,
            steps: s.steps,
          })),
          ...config.browser_scenarios.map((s) => ({
            name: s.name,
            steps: s.steps,
          })),
        ];

        if (allScenarios.length === 0) {
          console.log('No scenarios found to estimate.');
          return;
        }

        const models = getEstimateModels();
        const estimate = estimateCost(opts.model, allScenarios, parseInt(opts.fps, 10));
        console.log(formatCostEstimate(estimate));
        console.log('');
        console.log(`Available models: ${models.join(', ')}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
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
