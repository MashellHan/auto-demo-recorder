import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from './config/loader.js';
import { readHistory } from './analytics/history.js';
import { filterEntriesByConfig } from './cli-utils.js';
import { computeBenchmarks, formatBenchmarks } from './analytics/benchmarks.js';
import { computeFreshness, formatFreshness } from './analytics/freshness.js';
import { analyzeRates, formatRateAnalysis } from './analytics/rate-analysis.js';
import { computeHealthDashboard, formatHealthDashboard } from './analytics/health-dashboard.js';
import { analyzeStreaks, formatStreaks } from './analytics/streaks.js';
import { computeRiskScores, formatRiskScores } from './analytics/risk-score.js';
import { computeEfficiency, formatEfficiency } from './analytics/efficiency.js';
import { analyzeVelocity, formatVelocity } from './analytics/velocity.js';
import { analyzeCapacity, formatCapacity } from './analytics/capacity.js';
import { analyzeQualityTrends, formatQualityTrends } from './analytics/quality-trends.js';
import { generateDigest, formatDigest } from './analytics/digest.js';
import type { DigestPeriod } from './analytics/digest.js';
import { generateForecast, formatForecast } from './analytics/forecast.js';
import type { ForecastMethod } from './analytics/forecast.js';
import { analyzeCohorts, formatCohorts } from './analytics/cohort.js';
import type { CohortGranularity } from './analytics/cohort.js';
import { computeBurndown, formatBurndown } from './analytics/burndown.js';
import { computeHealthScore, formatHealthScore } from './analytics/health-score.js';

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
  registerQualityTrendsCommand(program);
  registerDigestCommand(program);
  registerForecastCommand(program);
  registerCohortsCommand(program);
  registerBurndownCommand(program);
  registerHealthScoreCommand(program);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
        const workHours = opts.workHours ? parseFloat(opts.workHours) : 8;
        const result = analyzeCapacity(entries, new Date(), workHours);
        console.log(formatCapacity(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDigestCommand(program: Command): void {
  program
    .command('digest')
    .description('Show daily or weekly recording summary digest with highlights and concerns')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--period <period>', 'Digest period: daily or weekly (default: daily)')
    .action(async (opts: { config?: string; period?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
        const period: DigestPeriod = opts.period === 'weekly' ? 'weekly' : 'daily';
        const result = generateDigest(entries, period);
        console.log(formatDigest(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerQualityTrendsCommand(program: Command): void {
  program
    .command('quality-trends')
    .description('Show recording quality trends over time windows')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--window-days <days>', 'Window size in days (default: 7)')
    .option('--max-windows <n>', 'Maximum windows to analyze (default: 8)')
    .action(async (opts: { config?: string; windowDays?: string; maxWindows?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
        const windowDays = opts.windowDays ? parseInt(opts.windowDays, 10) : 7;
        const maxWindows = opts.maxWindows ? parseInt(opts.maxWindows, 10) : 8;
        const result = analyzeQualityTrends(entries, windowDays, maxWindows);
        console.log(formatQualityTrends(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerForecastCommand(program: Command): void {
  program
    .command('forecast')
    .description('Forecast future recording volumes and success rates')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--days <n>', 'Number of days to forecast (default: 7)')
    .option('--method <method>', 'Forecast method: sma or ema (default: ema)')
    .option('--window <n>', 'SMA window size (default: 7)')
    .option('--alpha <n>', 'EMA smoothing factor 0-1 (default: 0.3)')
    .option('--lookback <n>', 'Historical lookback days (default: 30)')
    .action(async (opts: { config?: string; days?: string; method?: string; window?: string; alpha?: string; lookback?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
        const days = opts.days ? parseInt(opts.days, 10) : 7;
        const method: ForecastMethod = opts.method === 'sma' ? 'sma' : 'ema';
        const windowSize = opts.window ? parseInt(opts.window, 10) : 7;
        const alpha = opts.alpha ? parseFloat(opts.alpha) : 0.3;
        const lookback = opts.lookback ? parseInt(opts.lookback, 10) : 30;
        const result = generateForecast(entries, days, method, windowSize, alpha, new Date(), lookback);
        console.log(formatForecast(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerCohortsCommand(program: Command): void {
  program
    .command('cohorts')
    .description('Analyze recording cohorts by scenario first-appearance period')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--granularity <g>', 'Cohort granularity: weekly or monthly (default: weekly)')
    .action(async (opts: { config?: string; granularity?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
        const granularity: CohortGranularity = opts.granularity === 'monthly' ? 'monthly' : 'weekly';
        const result = analyzeCohorts(entries, granularity);
        console.log(formatCohorts(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerBurndownCommand(program: Command): void {
  program
    .command('burndown')
    .description('Show recording burndown chart toward a target')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--target <n>', 'Target number of recordings (default: 100)')
    .option('--start <date>', 'Sprint start date (ISO, default: 30 days ago)')
    .option('--deadline <date>', 'Sprint deadline (ISO, default: today)')
    .action(async (opts: { config?: string; target?: string; start?: string; deadline?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
        const target = opts.target ? parseInt(opts.target, 10) : 100;
        const now = new Date();
        const startDate = opts.start ? new Date(opts.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const deadline = opts.deadline ? new Date(opts.deadline) : now;
        const result = computeBurndown(entries, target, startDate, deadline, now);
        console.log(formatBurndown(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerHealthScoreCommand(program: Command): void {
  program
    .command('health-score')
    .description('Show composite recording health score (0-100) with dimension breakdown')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--window <days>', 'Analysis window in days (default: 30)')
    .action(async (opts: { config?: string; window?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
        const windowDays = opts.window ? parseInt(opts.window, 10) : 30;
        const result = computeHealthScore(entries, windowDays);
        console.log(formatHealthScore(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
