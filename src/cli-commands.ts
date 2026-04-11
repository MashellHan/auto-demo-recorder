import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from './config/loader.js';
import { pruneRecordings, formatPruneReport } from './pipeline/prune.js';
import { generateCIConfig, getSupportedProviders } from './config/ci-generator.js';
import { runHealthCheck, formatHealthCheck } from './pipeline/health-check.js';
import { PluginRegistry, formatPluginList } from './pipeline/plugin-system.js';
import { listSnapshots, saveSnapshot, restoreSnapshot, formatSnapshotList } from './pipeline/snapshots.js';
import { estimateCost, getEstimateModels, formatCostEstimate } from './analytics/cost-estimator.js';
import { registerAnalyticsCommands } from './cli-analytics-commands.js';
import { registerConfigCommands } from './cli-config-commands.js';

/**
 * Register all extracted CLI commands onto the given program.
 *
 * Commands are split into three groups:
 * - Analytics commands (cli-analytics-commands.ts)
 * - Config commands (cli-config-commands.ts)
 * - Infrastructure commands (this file)
 */
export function registerCommands(program: Command): void {
  registerAnalyticsCommands(program);
  registerConfigCommands(program);

  // Infrastructure/admin commands
  registerPruneCommand(program);
  registerCiCommand(program);
  registerDoctorCommand(program);
  registerPluginsCommand(program);
  registerSnapshotCommand(program);
  registerEstimateCommand(program);
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
