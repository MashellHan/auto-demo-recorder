import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from './config/loader.js';
import { resolveSessionPath } from './cli-utils.js';
import { analyzeTimingFromReport, formatTimingReport } from './analytics/timing.js';
import { captureEnvironmentSnapshot, formatEnvironmentSnapshot } from './pipeline/environment.js';
import { migrateConfig, formatMigrationReport } from './config/migration.js';
import { pruneRecordings, formatPruneReport } from './pipeline/prune.js';
import { generateCIConfig, getSupportedProviders } from './config/ci-generator.js';
import { runHealthCheck, formatHealthCheck } from './pipeline/health-check.js';
import { saveBaseline, checkBaseline, listBaselines, formatBaselineComparison } from './analytics/baseline.js';
import { exportJsonSchema } from './config/schema-export.js';
import { ANNOTATION_LANGUAGES, getLanguageInstruction, listLanguages } from './config/languages.js';

/**
 * Register production/analytics CLI commands onto the given program.
 * Extracted from cli.ts to keep that file under 800 lines.
 */
export function registerCommands(program: Command): void {
  registerAnalyzeCommand(program);
  registerEnvCommand(program);
  registerMigrateCommand(program);
  registerPruneCommand(program);
  registerCiCommand(program);
  registerDoctorCommand(program);
  registerBaselineCommand(program);
  registerSchemaCommand(program);
  registerLanguagesCommand(program);
}

function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze step timing of a recorded scenario')
    .argument('<path>', 'Path to scenario directory (e.g., 2026-04-11_08-00/basic)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (analyzePath: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const resolvedPath = resolveSessionPath(outputDir, analyzePath);
        const reportPath = join(outputDir, resolvedPath, 'report.json');

        if (!existsSync(reportPath)) {
          throw new Error(`Report not found: ${reportPath}`);
        }

        const analysis = await analyzeTimingFromReport(reportPath);
        console.log(formatTimingReport(analysis));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
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

function registerBaselineCommand(program: Command): void {
  const baselineCmd = program
    .command('baseline')
    .description('Manage recording baselines for regression detection');

  baselineCmd
    .command('save <scenario>')
    .description('Save the latest recording as the baseline for a scenario')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (scenario: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const result = await saveBaseline(outputDir, scenario);
        console.log(`✓ Baseline saved for "${scenario}"`);
        console.log(`  From: ${result.savedFrom}`);
        console.log(`  To: ${result.baselinePath}`);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  baselineCmd
    .command('check <scenario>')
    .description('Compare the latest recording against the saved baseline')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (scenario: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const comparison = await checkBaseline(outputDir, scenario);
        console.log(formatBaselineComparison(comparison));
        if (!comparison.passed) process.exit(1);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  baselineCmd
    .command('list')
    .description('List all saved baselines')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const baselines = await listBaselines(outputDir);
        if (baselines.length === 0) {
          console.log('No baselines saved yet. Use "demo-recorder baseline save <scenario>" to create one.');
          return;
        }
        console.log('Saved Baselines:\n');
        for (const b of baselines) {
          console.log(`  ${b.scenario.padEnd(24)} Status: ${b.status}, Bugs: ${b.bugs}, Duration: ${b.duration.toFixed(1)}s`);
          console.log(`  ${''.padEnd(24)} Saved: ${b.savedAt}`);
          console.log('');
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
