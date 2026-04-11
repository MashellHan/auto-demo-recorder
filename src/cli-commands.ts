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
import { listTemplates, findTemplate, getTemplateCategories } from './config/templates.js';
import { computeMetrics, formatMetrics } from './analytics/metrics.js';
import { visualDiff, formatVisualDiff } from './analytics/visual-diff.js';
import { generateSessionSummary, summarizeSession, formatSessionSummary } from './pipeline/summary.js';
import { generateComparisonMatrix, formatComparisonMatrix } from './analytics/comparison-matrix.js';
import { computeTagStats, formatTagStats } from './analytics/tag-stats.js';
import { resolveExtendsChain, formatExtendsChain } from './config/extends-resolver.js';
import { generateComparisonReport, formatComparisonReport } from './analytics/comparison-report.js';
import { generateValidationHints, formatValidationHints } from './config/validation-hints.js';
import { readHistory, formatHistoryTable } from './analytics/history.js';
import { findScenario } from './config/loader.js';

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
  registerTemplatesCommand(program);
  registerMetricsCommand(program);
  registerVisualDiffCommand(program);
  registerSummaryCommand(program);
  registerMatrixCommand(program);
  registerTagStatsCommand(program);
  registerExtendsCommand(program);
  registerShowCommand(program);
  registerCompareCommand(program);
  registerHistoryCommand(program);
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

function registerMetricsCommand(program: Command): void {
  program
    .command('metrics')
    .description('Show recording quality metrics and trends')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const metrics = await computeMetrics(outputDir);
        console.log(formatMetrics(metrics));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerVisualDiffCommand(program: Command): void {
  program
    .command('visual-diff')
    .description('Compare frame descriptions between two recording sessions')
    .argument('<sessionA>', 'Session A timestamp')
    .argument('<sessionB>', 'Session B timestamp')
    .argument('<scenario>', 'Scenario name to compare')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (sessionA: string, sessionB: string, scenario: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const resolvedA = resolveSessionPath(outputDir, sessionA);
        const resolvedB = resolveSessionPath(outputDir, sessionB);
        const result = await visualDiff(outputDir, resolvedA, resolvedB, scenario);
        console.log(formatVisualDiff(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerSummaryCommand(program: Command): void {
  program
    .command('summary')
    .description('Show a summary of the latest recording session')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-s, --session <timestamp>', 'Specific session to summarize (default: latest)')
    .action(async (opts: { config?: string; session?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);

        const summary = opts.session
          ? await summarizeSession(outputDir, resolveSessionPath(outputDir, opts.session))
          : await generateSessionSummary(outputDir);

        if (!summary) {
          console.log('No recording sessions found.');
          return;
        }

        console.log(formatSessionSummary(summary));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerMatrixCommand(program: Command): void {
  program
    .command('matrix')
    .description('Show a comparison matrix of scenarios across sessions')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const matrix = await generateComparisonMatrix(outputDir);
        console.log(formatComparisonMatrix(matrix));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerTagStatsCommand(program: Command): void {
  program
    .command('tag-stats')
    .description('Show tag-level recording analytics')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const allScenarios = [
          ...config.scenarios.map((s) => ({ name: s.name, tags: s.tags })),
          ...config.browser_scenarios.map((s) => ({ name: s.name, tags: s.tags })),
        ];
        const analytics = await computeTagStats(outputDir, allScenarios);
        console.log(formatTagStats(analytics));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
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

        // Search in terminal scenarios first, then browser
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
          const comment = (step as any).comment ? ` — ${(step as any).comment}` : '';
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

function registerCompareCommand(program: Command): void {
  program
    .command('compare')
    .description('Compare two recording sessions side-by-side')
    .argument('<sessionA>', 'First session timestamp')
    .argument('<sessionB>', 'Second session timestamp')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (sessionA: string, sessionB: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const resolvedA = resolveSessionPath(outputDir, sessionA);
        const resolvedB = resolveSessionPath(outputDir, sessionB);
        const report = await generateComparisonReport(outputDir, resolvedA, resolvedB);
        console.log(formatComparisonReport(report));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerHistoryCommand(program: Command): void {
  program
    .command('history')
    .description('Show recording history log')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--since <date>', 'Show entries after this date (e.g., 2026-04-01)')
    .option('--scenario <name>', 'Filter by scenario name')
    .option('--status <status>', 'Filter by status (ok, warning, error)')
    .option('-n, --limit <n>', 'Limit number of entries')
    .action(async (opts: { config?: string; since?: string; scenario?: string; status?: string; limit?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);

        const entries = await readHistory(outputDir, {
          since: opts.since ? new Date(opts.since) : undefined,
          scenario: opts.scenario,
          status: opts.status,
          limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        });

        console.log(formatHistoryTable(entries));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
