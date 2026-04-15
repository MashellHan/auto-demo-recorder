import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from './config/loader.js';
import { readHistory, compactHistory } from './analytics/history.js';
import { filterEntriesByConfig } from './cli-utils.js';
import { detectDuplicates, formatDuplicates } from './analytics/duplicates.js';
import { groupRecordings, formatGrouping } from './analytics/grouping.js';
import { generateAlerts, formatAlerts } from './analytics/alerts.js';
import { checkSla, formatSla } from './analytics/sla.js';
import { evaluateRetention, formatRetention } from './analytics/retention.js';
import { diffSessionEntries, formatSessionDiffSummary } from './analytics/session-diff-summary.js';
import { computeCoverage, formatCoverage } from './analytics/coverage.js';
import type { GroupBy } from './analytics/grouping.js';

/**
 * Register operational/monitoring analytics CLI commands onto the given program.
 *
 * Split from cli-analytics-extra-commands.ts to keep files under 500 lines.
 * Measurement/metrics commands live in cli-analytics-metrics-commands.ts.
 * Commands: duplicates, group, alerts, sla, retention, compact, session-diff-summary, coverage.
 */
export function registerAnalyticsMonitorCommands(program: Command): void {
  registerDuplicatesCommand(program);
  registerGroupCommand(program);
  registerAlertsCommand(program);
  registerSlaCommand(program);
  registerRetentionCommand(program);
  registerCompactCommand(program);
  registerSessionDiffSummaryCommand(program);
  registerCoverageCommand(program);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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

function registerCompactCommand(program: Command): void {
  program
    .command('compact')
    .description('Compact recording history by applying retention policy and removing old entries')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--max-age <days>', 'Maximum recording age in days (default: 30)')
    .option('--max-count <n>', 'Maximum total recordings to keep (default: 1000)')
    .option('--max-per-scenario <n>', 'Maximum recordings per scenario (default: 100)')
    .option('--no-keep-failed', 'Allow removing failed recordings')
    .option('--dry-run', 'Show what would be removed without modifying files')
    .action(async (opts: { config?: string; maxAge?: string; maxCount?: string; maxPerScenario?: string; keepFailed?: boolean; dryRun?: boolean }) => {
      try {
        const config = await loadConfig(opts.config);
        const outputDir = resolve(process.cwd(), config.output.dir);
        const policy = {
          maxAgeDays: opts.maxAge ? parseInt(opts.maxAge, 10) : undefined,
          maxCount: opts.maxCount ? parseInt(opts.maxCount, 10) : undefined,
          maxPerScenario: opts.maxPerScenario ? parseInt(opts.maxPerScenario, 10) : undefined,
          keepFailed: opts.keepFailed,
        };
        const result = await compactHistory(outputDir, policy, opts.dryRun ?? false);
        console.log(result.summary);
        if (result.removedCount > 0) {
          console.log(`\n  Before: ${result.totalBefore} entries`);
          console.log(`  After:  ${result.keptCount} entries`);
          console.log(`  Removed: ${result.removedCount} entries`);
        }
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
        const allEntries = filterEntriesByConfig(await readHistory(outputDir), config);
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
        const entries = filterEntriesByConfig(await readHistory(outputDir), config);
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
