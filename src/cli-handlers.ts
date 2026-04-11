import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { findScenario } from './config/loader.js';
import { buildAdhocConfig, buildAdhocScenario } from './config/adhoc.js';
import { record, recordBrowser, writeSessionReport, formatTimestamp } from './index.js';
import { pLimit } from './pipeline/concurrency.js';
import { withRetry } from './pipeline/retry.js';
import type { Step, BrowserScenario } from './config/schema.js';
import type { Logger } from './pipeline/annotator.js';

/** Filter scenarios by tag. Supports negation with "!" prefix. */
export function filterByTag<T extends { tags?: string[] }>(scenarios: T[], tag: string): T[] {
  if (tag.startsWith('!')) {
    const excludeTag = tag.slice(1).toLowerCase();
    return scenarios.filter((s) => !(s.tags ?? []).some((t) => t.toLowerCase() === excludeTag));
  }
  const includeTag = tag.toLowerCase();
  return scenarios.filter((s) => (s.tags ?? []).some((t) => t.toLowerCase() === includeTag));
}

export async function handleVhsRecord(
  config: ReturnType<typeof Object>,
  scenarioName: string | undefined,
  projectDir: string,
  logger: Logger | undefined,
  quiet: boolean | undefined,
  tag?: string,
  parallel?: boolean,
  maxWorkers?: number,
  maxRetries?: number,
) {
  let scenarios = scenarioName
    ? [findScenario(config as any, scenarioName)]
    : (config as any).scenarios;

  if (tag) {
    scenarios = filterByTag(scenarios, tag);
    if (scenarios.length === 0) {
      throw new Error(`No scenarios match tag "${tag}"`);
    }
  }

  const timestamp = formatTimestamp(new Date());

  if (parallel && scenarios.length > 1) {
    const limit = pLimit(maxWorkers ?? 3);
    if (!quiet) console.log(`Recording ${scenarios.length} scenarios in parallel (max ${maxWorkers ?? 3} workers)...`);
    const settled = await Promise.allSettled(
      scenarios.map((scenario: any) =>
        limit(() => record({ config: config as any, scenario, projectDir, logger, timestamp, skipSymlinkUpdate: true })),
      ),
    );
    const results = [];
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === 'fulfilled') {
        results.push(s.value);
        if (!quiet) console.log(`  ✓ ${scenarios[i].name} complete`);
      } else {
        if (!quiet) console.error(`  ✗ ${scenarios[i].name} failed: ${s.reason instanceof Error ? s.reason.message : s.reason}`);
      }
    }
    if (results.length > 1) {
      const sessionDir = dirname(dirname(results[0].reportPath));
      const sessionPath = join(sessionDir, 'session-report.json');
      const reports = await Promise.all(
        results.map(async (r) => JSON.parse(await readFile(r.reportPath, 'utf-8'))),
      );
      await writeSessionReport(sessionPath, (config as any).project.name, reports);
      if (!quiet) console.log(`Session report: ${sessionPath}`);
    }
    if (!quiet) console.log(`\n${results.length}/${scenarios.length} scenarios recorded successfully.`);
    return;
  }

  const results = [];
  for (const scenario of scenarios) {
    const recordFn = () => record({ config: config as any, scenario, projectDir, logger, timestamp });
    const result = maxRetries && maxRetries > 0
      ? await withRetry(recordFn, {
          maxRetries,
          baseDelayMs: 1000,
          onRetry: (attempt, err) => {
            if (!quiet) console.log(`  ⟳ Retrying "${scenario.name}" (attempt ${attempt}/${maxRetries}): ${err.message}`);
          },
        })
      : await recordFn();
    results.push(result);
    if (!quiet) console.log('');
  }

  if (results.length > 1) {
    const sessionDir = dirname(dirname(results[0].reportPath));
    const sessionPath = join(sessionDir, 'session-report.json');
    const reports = await Promise.all(
      results.map(async (r) => JSON.parse(await readFile(r.reportPath, 'utf-8'))),
    );
    await writeSessionReport(sessionPath, (config as any).project.name, reports);
    if (!quiet) console.log(`Session report: ${sessionPath}`);
  }
}

export async function handleBrowserRecord(
  config: ReturnType<typeof Object>,
  scenarioName: string | undefined,
  projectDir: string,
  logger: Logger | undefined,
  quiet: boolean | undefined,
  tag?: string,
  parallel?: boolean,
  maxWorkers?: number,
  maxRetries?: number,
) {
  let browserScenarios: BrowserScenario[] = scenarioName
    ? [(config as any).browser_scenarios.find((s: BrowserScenario) => s.name === scenarioName)]
    : (config as any).browser_scenarios;

  if (scenarioName && !browserScenarios[0]) {
    throw new Error(`Browser scenario "${scenarioName}" not found`);
  }

  if (tag) {
    browserScenarios = filterByTag(browserScenarios, tag);
    if (browserScenarios.length === 0) {
      throw new Error(`No browser scenarios match tag "${tag}"`);
    }
  }

  const timestamp = formatTimestamp(new Date());

  if (parallel && browserScenarios.length > 1) {
    const limit = pLimit(maxWorkers ?? 3);
    if (!quiet) console.log(`Recording ${browserScenarios.length} browser scenarios in parallel (max ${maxWorkers ?? 3} workers)...`);
    const settled = await Promise.allSettled(
      browserScenarios.map((scenario) =>
        limit(() => recordBrowser({ config: config as any, scenario, projectDir, logger, timestamp, skipSymlinkUpdate: true })),
      ),
    );
    const results = [];
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === 'fulfilled') {
        results.push(s.value);
        if (!quiet) console.log(`  ✓ ${browserScenarios[i].name} complete`);
      } else {
        if (!quiet) console.error(`  ✗ ${browserScenarios[i].name} failed: ${s.reason instanceof Error ? s.reason.message : s.reason}`);
      }
    }
    if (results.length > 1) {
      const sessionDir = dirname(dirname(results[0].reportPath));
      const sessionPath = join(sessionDir, 'session-report.json');
      const reports = await Promise.all(
        results.map(async (r) => JSON.parse(await readFile(r.reportPath, 'utf-8'))),
      );
      await writeSessionReport(sessionPath, (config as any).project.name, reports);
      if (!quiet) console.log(`Session report: ${sessionPath}`);
    }
    if (!quiet) console.log(`\n${results.length}/${browserScenarios.length} browser scenarios recorded successfully.`);
    return;
  }

  const results = [];
  for (const scenario of browserScenarios) {
    const recordFn = () => recordBrowser({ config: config as any, scenario, projectDir, logger, timestamp });
    const result = maxRetries && maxRetries > 0
      ? await withRetry(recordFn, {
          maxRetries,
          baseDelayMs: 1000,
          onRetry: (attempt, err) => {
            if (!quiet) console.log(`  ⟳ Retrying "${scenario.name}" (attempt ${attempt}/${maxRetries}): ${err.message}`);
          },
        })
      : await recordFn();
    results.push(result);
    if (!quiet) console.log('');
  }

  if (results.length > 1) {
    const sessionDir = dirname(dirname(results[0].reportPath));
    const sessionPath = join(sessionDir, 'session-report.json');
    const reports = await Promise.all(
      results.map(async (r) => JSON.parse(await readFile(r.reportPath, 'utf-8'))),
    );
    await writeSessionReport(sessionPath, (config as any).project.name, reports);
    if (!quiet) console.log(`Session report: ${sessionPath}`);
  }
}

export function parseAdhocSteps(stepsStr: string): Step[] {
  return stepsStr.split(',').map((token) => {
    const trimmed = token.trim();
    if (trimmed.startsWith('sleep:')) {
      return { action: 'sleep' as const, value: trimmed.slice(6), pause: '0ms' };
    }
    if (['enter', 'tab', 'escape', 'esc', 'backspace', 'up', 'down', 'left', 'right', 'space'].includes(trimmed.toLowerCase())) {
      return { action: 'key' as const, value: trimmed, pause: '500ms' };
    }
    if (trimmed.length === 1) {
      return { action: 'key' as const, value: trimmed, pause: '500ms' };
    }
    return { action: 'type' as const, value: trimmed, pause: '500ms' };
  });
}

export async function handleAdhocRecord(opts: {
  command?: string;
  url?: string;
  steps?: string;
  width: string;
  height: string;
  format: string;
  annotate: boolean;
  backend?: string;
  theme?: string;
}, logger?: Logger): Promise<void> {
  if (opts.backend === 'browser') {
    await handleAdhocBrowserRecord(opts, logger);
    return;
  }

  if (!opts.command) {
    throw new Error('--command is required with --adhoc mode');
  }

  const parsedSteps = opts.steps ? parseAdhocSteps(opts.steps) : undefined;
  const config = buildAdhocConfig({
    command: opts.command,
    steps: parsedSteps,
    width: parseInt(opts.width, 10),
    height: parseInt(opts.height, 10),
    format: opts.format === 'gif' ? 'gif' : 'mp4',
    annotate: opts.annotate,
    theme: opts.theme,
  });
  const scenario = buildAdhocScenario(opts.command, parsedSteps);

  await record({ config, scenario, projectDir: process.cwd(), logger });
}

export async function handleAdhocBrowserRecord(opts: {
  url?: string;
  steps?: string;
  width: string;
  height: string;
  annotate: boolean;
  theme?: string;
}, logger?: Logger): Promise<void> {
  if (!opts.url) {
    throw new Error('--url is required with --adhoc --backend browser mode');
  }

  const config = buildAdhocConfig({
    command: opts.url,
    width: parseInt(opts.width, 10),
    height: parseInt(opts.height, 10),
    format: 'mp4',
    annotate: opts.annotate,
    backend: 'browser',
    theme: opts.theme,
  });

  const browserSteps = opts.steps
    ? parseAdhocBrowserSteps(opts.steps)
    : [];

  const scenario: BrowserScenario = {
    name: 'adhoc-browser',
    description: `Ad-hoc browser recording: ${opts.url}`,
    url: opts.url,
    setup: [],
    steps: browserSteps,
    tags: [],
    depends_on: [],
  };

  await recordBrowser({ config, scenario, projectDir: process.cwd(), logger });
}

export function parseAdhocBrowserSteps(stepsStr: string): BrowserScenario['steps'] {
  return stepsStr.split(',').map((token) => {
    const trimmed = token.trim();
    if (trimmed.startsWith('sleep:')) {
      return { action: 'sleep' as const, value: trimmed.slice(6), pause: '0ms' };
    }
    if (trimmed.startsWith('click:')) {
      return { action: 'click' as const, value: trimmed.slice(6), pause: '500ms' };
    }
    if (trimmed.startsWith('fill:')) {
      const parts = trimmed.slice(5).split('=');
      return { action: 'fill' as const, value: parts[0], text: parts.slice(1).join('='), pause: '500ms' };
    }
    if (trimmed.startsWith('nav:')) {
      return { action: 'navigate' as const, value: trimmed.slice(4), pause: '1000ms' };
    }
    if (trimmed.startsWith('scroll:')) {
      return { action: 'scroll' as const, value: trimmed.slice(7), pause: '500ms' };
    }
    if (trimmed.startsWith('wait:')) {
      return { action: 'wait' as const, value: trimmed.slice(5), pause: '500ms' };
    }
    // Default: type the text
    return { action: 'type' as const, value: trimmed, pause: '500ms' };
  });
}
