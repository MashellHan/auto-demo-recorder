import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from './config/loader.js';
import { readHistory } from './analytics/history.js';
import { computeBenchmarks, formatBenchmarks } from './analytics/benchmarks.js';
import { computeFreshness, formatFreshness } from './analytics/freshness.js';
import { analyzeRates, formatRateAnalysis } from './analytics/rate-analysis.js';
import { computeHealthDashboard, formatHealthDashboard } from './analytics/health-dashboard.js';
import { analyzeStreaks, formatStreaks } from './analytics/streaks.js';
import { computeRiskScores, formatRiskScores } from './analytics/risk-score.js';
import { computeEfficiency, formatEfficiency } from './analytics/efficiency.js';
import { analyzeVelocity, formatVelocity } from './analytics/velocity.js';
import { analyzeCapacity, formatCapacity } from './analytics/capacity.js';

/**
 * Register measurement/metrics analytics CLI commands onto the given program.
 *
 * Split from cli-analytics-monitor-commands.ts to keep files under 500 lines.
 * Commands: benchmarks, freshness, rates, dashboard, streaks, risk, efficiency, velocity.
 */
export function registerAnalyticsMetricsCommands(program: Command): void {
  registerBenchmarksCommand(program);
  registerFreshnessCommand(program);
  registerRatesCommand(program);
  registerDashboardCommand(program);
  registerStreaksCommand(program);
  registerRiskCommand(program);
  registerEfficiencyCommand(program);
  registerVelocityCommand(program);
  registerCapacityCommand(program);
}

function registerBenchmarksCommand(program: Command): void {
  program
    .command('benchmarks')
    .description('Show p50/p95/p99 duration benchmarks per scenario')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = computeBenchmarks(entries);
        console.log(formatBenchmarks(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerFreshnessCommand(program: Command): void {
  program
    .command('freshness')
    .description('Show recording freshness index per scenario')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = computeFreshness(entries);
        console.log(formatFreshness(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerRatesCommand(program: Command): void {
  program
    .command('rates')
    .description('Analyze recording frequency rates (daily/weekly, peaks, velocity)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = analyzeRates(entries);
        console.log(formatRateAnalysis(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Show unified recording health dashboard')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = computeHealthDashboard(entries);
        console.log(formatHealthDashboard(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerStreaksCommand(program: Command): void {
  program
    .command('streaks')
    .description('Show recording streak analysis (consecutive days)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = analyzeStreaks(entries);
        console.log(formatStreaks(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerRiskCommand(program: Command): void {
  program
    .command('risk')
    .description('Show scenario risk scores (failure, volatility, staleness)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = computeRiskScores(entries);
        console.log(formatRiskScores(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerEfficiencyCommand(program: Command): void {
  program
    .command('efficiency')
    .description('Show recording efficiency metrics (utilization, throughput, idle time)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = computeEfficiency(entries);
        console.log(formatEfficiency(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerVelocityCommand(program: Command): void {
  program
    .command('velocity')
    .description('Show recording velocity over rolling windows with projections')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = analyzeVelocity(entries);
        console.log(formatVelocity(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerCapacityCommand(program: Command): void {
  program
    .command('capacity')
    .description('Show recording capacity projections and bottleneck analysis')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--work-hours <hours>', 'Work hours per day for utilization calc (default: 8)')
    .action(async (opts: { config?: string; workHours?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const workHours = opts.workHours ? parseFloat(opts.workHours) : 8;
        const result = analyzeCapacity(entries, new Date(), workHours);
        console.log(formatCapacity(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
