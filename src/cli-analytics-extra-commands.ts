import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from './config/loader.js';
import { readHistory } from './analytics/history.js';
import { generateHeatMap, formatHeatMap } from './analytics/heatmap.js';
import { computeScoreCard, formatScoreCard } from './analytics/scorecard.js';
import { suggestTags, formatTagSuggestions } from './analytics/tag-suggestions.js';
import { computeStatusOverview, formatStatusOverview } from './analytics/status-overview.js';
import { analyzeTrends, formatTrendReport } from './analytics/trends.js';
import { detectOutliers, detectOutliersPerScenario, formatOutliers, formatOutliersPerScenario } from './analytics/outliers.js';
import { computeCorrelations, formatCorrelations } from './analytics/correlation.js';
import { detectDuplicates, formatDuplicates } from './analytics/duplicates.js';
import { groupRecordings, formatGrouping } from './analytics/grouping.js';
import { generateAlerts, formatAlerts } from './analytics/alerts.js';
import type { GroupBy } from './analytics/grouping.js';

/**
 * Register extra analytics CLI commands onto the given program.
 *
 * Split from cli-analytics-commands.ts to keep files under 500 lines.
 * Commands: heatmap, scorecard, suggest-tags, status, trends, outliers.
 */
export function registerAnalyticsExtraCommands(program: Command): void {
  registerHeatMapCommand(program);
  registerScoreCardCommand(program);
  registerTagSuggestCommand(program);
  registerStatusOverviewCommand(program);
  registerTrendsCommand(program);
  registerOutliersCommand(program);
  registerCorrelationCommand(program);
  registerDuplicatesCommand(program);
  registerGroupCommand(program);
  registerAlertsCommand(program);
}

function registerHeatMapCommand(program: Command): void {
  program
    .command('heatmap')
    .description('Show recording frequency heat map by day and hour')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);

        const entries = await readHistory(outputDir);
        const result = generateHeatMap(entries);
        console.log(formatHeatMap(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerScoreCardCommand(program: Command): void {
  program
    .command('scorecard')
    .description('Show recording quality score card')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);

        const entries = await readHistory(outputDir);
        const card = computeScoreCard(entries);
        console.log(formatScoreCard(card));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerTagSuggestCommand(program: Command): void {
  program
    .command('suggest-tags')
    .description('Suggest tags for scenarios based on step patterns')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const result = suggestTags(config);
        console.log(formatTagSuggestions(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerStatusOverviewCommand(program: Command): void {
  program
    .command('status')
    .description('Show per-scenario health status overview')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const overview = computeStatusOverview(entries);
        console.log(formatStatusOverview(overview));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerTrendsCommand(program: Command): void {
  program
    .command('trends')
    .description('Show recording quality trends over time')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = analyzeTrends(entries);
        console.log(formatTrendReport(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerOutliersCommand(program: Command): void {
  program
    .command('outliers')
    .description('Detect outlier recordings by duration, bugs, or status')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-t, --threshold <n>', 'Z-score threshold (default: 2.0)')
    .option('--per-scenario', 'Detect outliers within each scenario independently')
    .action(async (opts: { config?: string; threshold?: string; perScenario?: boolean }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const threshold = opts.threshold ? parseFloat(opts.threshold) : 2.0;

        if (opts.perScenario) {
          const result = detectOutliersPerScenario(entries, threshold);
          console.log(formatOutliersPerScenario(result));
        } else {
          const result = detectOutliers(entries, threshold);
          console.log(formatOutliers(result));
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerCorrelationCommand(program: Command): void {
  program
    .command('correlations')
    .description('Show scenario outcome correlations (which scenarios fail together)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--min-sessions <n>', 'Minimum shared sessions for analysis (default: 3)')
    .action(async (opts: { config?: string; minSessions?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const minSessions = opts.minSessions ? parseInt(opts.minSessions, 10) : 3;
        const result = computeCorrelations(entries, minSessions);
        console.log(formatCorrelations(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDuplicatesCommand(program: Command): void {
  program
    .command('duplicates')
    .description('Detect duplicate recordings in history')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--window <seconds>', 'Time window for near-duplicate detection (default: 60)')
    .action(async (opts: { config?: string; window?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const windowSeconds = opts.window ? parseInt(opts.window, 10) : 60;
        const result = detectDuplicates(entries, windowSeconds);
        console.log(formatDuplicates(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerGroupCommand(program: Command): void {
  program
    .command('group')
    .description('Group recordings by day, week, scenario, backend, or status')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--by <criterion>', 'Group by: day, week, scenario, backend, status (default: day)')
    .action(async (opts: { config?: string; by?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const groupBy = (opts.by ?? 'day') as GroupBy;
        if (!['day', 'week', 'scenario', 'backend', 'status'].includes(groupBy)) {
          console.error(`Invalid group-by criterion: ${groupBy}. Use day, week, scenario, backend, or status.`);
          process.exit(1);
        }
        const result = groupRecordings(entries, groupBy);
        console.log(formatGrouping(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerAlertsCommand(program: Command): void {
  program
    .command('alerts')
    .description('Show scenario health alerts (failure rate, duration, bugs)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--max-failure <rate>', 'Warning failure rate threshold (default: 0.2)')
    .option('--max-duration <seconds>', 'Max average duration threshold (default: 60)')
    .action(async (opts: { config?: string; maxFailure?: string; maxDuration?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const thresholds = {
          maxFailureRate: opts.maxFailure ? parseFloat(opts.maxFailure) : undefined,
          maxDuration: opts.maxDuration ? parseFloat(opts.maxDuration) : undefined,
        };
        const result = generateAlerts(entries, thresholds);
        console.log(formatAlerts(result));
        if (result.alerts.some((a) => a.severity === 'critical')) process.exit(1);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
