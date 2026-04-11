import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig } from './config/loader.js';
import { resolveSessionPath } from './cli-utils.js';
import { analyzeTimingFromReport, formatTimingReport } from './analytics/timing.js';
import { saveBaseline, checkBaseline, listBaselines, formatBaselineComparison } from './analytics/baseline.js';
import { computeMetrics, formatMetrics } from './analytics/metrics.js';
import { visualDiff, formatVisualDiff } from './analytics/visual-diff.js';
import { generateSessionSummary, summarizeSession, formatSessionSummary } from './pipeline/summary.js';
import { generateComparisonMatrix, formatComparisonMatrix } from './analytics/comparison-matrix.js';
import { computeTagStats, formatTagStats } from './analytics/tag-stats.js';
import { generateComparisonReport, formatComparisonReport } from './analytics/comparison-report.js';
import { readHistory, formatHistoryTable } from './analytics/history.js';
import { generateTimeline, formatTimeline } from './analytics/timeline.js';

/**
 * Register analytics CLI commands onto the given program.
 * Split from cli-commands.ts to keep files under 500 lines.
 */
export function registerAnalyticsCommands(program: Command): void {
  registerAnalyzeCommand(program);
  registerBaselineCommand(program);
  registerMetricsCommand(program);
  registerVisualDiffCommand(program);
  registerSummaryCommand(program);
  registerMatrixCommand(program);
  registerTagStatsCommand(program);
  registerCompareCommand(program);
  registerHistoryCommand(program);
  registerTimelineCommand(program);
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

function registerTimelineCommand(program: Command): void {
  program
    .command('timeline')
    .description('Show recording timeline with duration bars')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-n, --limit <n>', 'Limit number of entries')
    .action(async (opts: { config?: string; limit?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);

        const entries = await readHistory(outputDir, {
          limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        });

        const result = generateTimeline(entries);
        console.log(formatTimeline(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
