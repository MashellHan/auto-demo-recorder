import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from './config/loader.js';
import { readHistory } from './analytics/history.js';
import { detectDuplicates, formatDuplicates } from './analytics/duplicates.js';
import { groupRecordings, formatGrouping } from './analytics/grouping.js';
import { generateAlerts, formatAlerts } from './analytics/alerts.js';
import { checkSla, formatSla } from './analytics/sla.js';
import { evaluateRetention, formatRetention } from './analytics/retention.js';
import { diffSessionEntries, formatSessionDiffSummary } from './analytics/session-diff-summary.js';
import { computeBenchmarks, formatBenchmarks } from './analytics/benchmarks.js';
import { computeFreshness, formatFreshness } from './analytics/freshness.js';
import { computeCoverage, formatCoverage } from './analytics/coverage.js';
import { analyzeRates, formatRateAnalysis } from './analytics/rate-analysis.js';
import { computeHealthDashboard, formatHealthDashboard } from './analytics/health-dashboard.js';
import { analyzeStreaks, formatStreaks } from './analytics/streaks.js';
import { computeRiskScores, formatRiskScores } from './analytics/risk-score.js';
import { computeEfficiency, formatEfficiency } from './analytics/efficiency.js';
import type { GroupBy } from './analytics/grouping.js';

/**
 * Register operational/monitoring analytics CLI commands onto the given program.
 *
 * Split from cli-analytics-extra-commands.ts to keep files under 500 lines.
 * Commands: duplicates, group, alerts, sla, retention, session-diff-summary,
 *           benchmarks, freshness, coverage, rates.
 */
export function registerAnalyticsMonitorCommands(program: Command): void {
  registerDuplicatesCommand(program);
  registerGroupCommand(program);
  registerAlertsCommand(program);
  registerSlaCommand(program);
  registerRetentionCommand(program);
  registerSessionDiffSummaryCommand(program);
  registerBenchmarksCommand(program);
  registerFreshnessCommand(program);
  registerCoverageCommand(program);
  registerRatesCommand(program);
  registerDashboardCommand(program);
  registerStreaksCommand(program);
  registerRiskCommand(program);
  registerEfficiencyCommand(program);
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

function registerSlaCommand(program: Command): void {
  program
    .command('sla')
    .description('Check SLA compliance against recording history')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--min-success <rate>', 'Minimum success rate percentage (default: 95)')
    .option('--max-duration <seconds>', 'Maximum average duration in seconds (default: 30)')
    .option('--max-bugs <count>', 'Maximum bugs per recording (default: 0)')
    .option('--min-recordings <count>', 'Minimum total recordings required (default: 1)')
    .action(async (opts: { config?: string; minSuccess?: string; maxDuration?: string; maxBugs?: string; minRecordings?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const targets: Record<string, number> = {};
        if (opts.minSuccess) targets.minSuccessRate = parseFloat(opts.minSuccess);
        if (opts.maxDuration) targets.maxAvgDuration = parseFloat(opts.maxDuration);
        if (opts.maxBugs) targets.maxBugsPerRun = parseFloat(opts.maxBugs);
        if (opts.minRecordings) targets.minRecordings = parseInt(opts.minRecordings, 10);
        const result = checkSla(entries, targets);
        console.log(formatSla(result));
        if (!result.compliant) process.exit(1);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerRetentionCommand(program: Command): void {
  program
    .command('retention')
    .description('Evaluate recording retention policy and show cleanup candidates')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--max-age <days>', 'Maximum recording age in days (default: 30)')
    .option('--max-count <n>', 'Maximum total recordings (default: 1000)')
    .option('--max-per-scenario <n>', 'Maximum recordings per scenario (default: 100)')
    .option('--no-keep-failed', 'Allow removing failed recordings')
    .action(async (opts: { config?: string; maxAge?: string; maxCount?: string; maxPerScenario?: string; keepFailed?: boolean }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const policy = {
          maxAgeDays: opts.maxAge ? parseInt(opts.maxAge, 10) : undefined,
          maxCount: opts.maxCount ? parseInt(opts.maxCount, 10) : undefined,
          maxPerScenario: opts.maxPerScenario ? parseInt(opts.maxPerScenario, 10) : undefined,
          keepFailed: opts.keepFailed,
        };
        const result = evaluateRetention(entries, policy);
        console.log(formatRetention(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerSessionDiffSummaryCommand(program: Command): void {
  program
    .command('session-diff-summary')
    .description('Concise summary of differences between two recording sessions')
    .argument('<sessionA>', 'First session ID')
    .argument('<sessionB>', 'Second session ID')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (sessionA: string, sessionB: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const allEntries = await readHistory(outputDir);
        const entriesA = allEntries.filter((e) => e.sessionId === sessionA);
        const entriesB = allEntries.filter((e) => e.sessionId === sessionB);

        if (entriesA.length === 0) {
          console.error(`No recordings found for session "${sessionA}".`);
          process.exit(1);
        }
        if (entriesB.length === 0) {
          console.error(`No recordings found for session "${sessionB}".`);
          process.exit(1);
        }

        const result = diffSessionEntries(entriesA, entriesB, sessionA, sessionB);
        console.log(formatSessionDiffSummary(result));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
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

function registerCoverageCommand(program: Command): void {
  program
    .command('coverage')
    .description('Show scenario recording coverage report')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--stale-days <days>', 'Days after which a scenario is stale (default: 7)')
    .action(async (opts: { config?: string; staleDays?: string }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const entries = await readHistory(outputDir);
        const staleDays = opts.staleDays ? parseInt(opts.staleDays, 10) : 7;
        const scenarioNames = [
          ...config.scenarios.map((s) => s.name),
          ...config.browser_scenarios.map((s) => s.name),
        ];
        const report = computeCoverage(scenarioNames, entries, staleDays);
        console.log(formatCoverage(report));
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
