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
import { analyzeImpact, analyzeFailureImpact, formatImpactAnalysis } from './analytics/impact-analysis.js';
import { analyzeDistribution, formatDistribution } from './analytics/distribution.js';
import { detectAnomalies, formatAnomalies } from './analytics/anomaly.js';
import { fingerprintSessions, formatFingerprints } from './analytics/fingerprint.js';

/**
 * Register descriptive analytics CLI commands onto the given program.
 *
 * Split from cli-analytics-commands.ts to keep files under 500 lines.
 * Commands: heatmap, scorecard, suggest-tags, status, trends, outliers, correlations.
 *
 * Operational/monitoring commands live in cli-analytics-monitor-commands.ts.
 */
export function registerAnalyticsExtraCommands(program: Command): void {
  registerHeatMapCommand(program);
  registerScoreCardCommand(program);
  registerTagSuggestCommand(program);
  registerStatusOverviewCommand(program);
  registerTrendsCommand(program);
  registerOutliersCommand(program);
  registerCorrelationCommand(program);
  registerImpactCommand(program);
  registerDistributionCommand(program);
  registerAnomalyCommand(program);
  registerFingerprintCommand(program);
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

function registerImpactCommand(program: Command): void {
  program
    .command('impact')
    .description('Show dependency impact analysis (blast radius when a scenario fails)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--scenario <name>', 'Analyze impact of a specific failing scenario')
    .action(async (opts: { config?: string; scenario?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const allScenarios = [
          ...config.scenarios.map((s) => ({ name: s.name, depends_on: s.depends_on })),
          ...config.browser_scenarios.map((s) => ({ name: s.name, depends_on: s.depends_on })),
        ];

        if (opts.scenario) {
          const result = analyzeFailureImpact(allScenarios, [opts.scenario]);
          console.log(formatImpactAnalysis(result));
        } else {
          const result = analyzeImpact(allScenarios);
          console.log(formatImpactAnalysis(result));
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerDistributionCommand(program: Command): void {
  program
    .command('distribution')
    .description('Analyze recording distribution across scenarios (Gini coefficient)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const result = analyzeDistribution(entries);
        console.log(formatDistribution(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerAnomalyCommand(program: Command): void {
  program
    .command('anomalies')
    .description('Detect recording anomalies using Z-score analysis')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--threshold <z>', 'Z-score threshold for flagging (default: 2.0)')
    .action(async (opts: { config?: string; threshold?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const threshold = opts.threshold ? parseFloat(opts.threshold) : 2.0;
        const result = detectAnomalies(entries, threshold);
        console.log(formatAnomalies(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerFingerprintCommand(program: Command): void {
  program
    .command('fingerprints')
    .description('Generate session fingerprints and detect duplicates/similarities')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--threshold <pct>', 'Similarity threshold percentage (default: 80)')
    .action(async (opts: { config?: string; threshold?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const threshold = opts.threshold ? parseInt(opts.threshold, 10) : 80;
        const result = fingerprintSessions(entries, threshold);
        console.log(formatFingerprints(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
