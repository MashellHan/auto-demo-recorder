import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, findScenario } from '../config/loader.js';
import { buildAdhocConfig, buildAdhocScenario } from '../config/adhoc.js';
import { record, recordBrowser, updateLatestSymlink, writeSessionReport } from '../index.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
import type { Logger } from '../pipeline/annotator.js';
import type { BrowserScenario } from '../config/schema.js';

const TOOL_NAME = 'demo_recorder_record';

// MCP uses stdio transport — console.log would corrupt the protocol stream
const mcpLogger: Logger = {
  log: (msg) => process.stderr.write(`${msg}\n`),
  warn: (msg) => process.stderr.write(`WARN: ${msg}\n`),
};

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'demo-recorder', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAME,
        description:
          'Record a terminal or browser demo video. Captures video and optionally annotates with AI for feature descriptions and bug detection.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            project_dir: {
              type: 'string',
              description: 'Path to the project directory containing demo-recorder.yaml',
            },
            scenario: {
              type: 'string',
              description: 'Name of scenario to record. If omitted, records all.',
            },
            backend: {
              type: 'string',
              enum: ['vhs', 'browser'],
              default: 'vhs',
              description: 'Recording backend: vhs (terminal) or browser (web UI)',
            },
            adhoc: {
              type: 'object',
              description: 'Ad-hoc recording without config file',
              properties: {
                command: { type: 'string', description: 'Command to run (terminal) or URL (browser)' },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', enum: ['type', 'key', 'sleep', 'navigate', 'click', 'fill', 'scroll', 'hover', 'select', 'wait'] },
                      value: { type: 'string' },
                      text: { type: 'string' },
                      pause: { type: 'string', default: '500ms' },
                    },
                    required: ['action', 'value'],
                  },
                },
                width: { type: 'number', default: 1200 },
                height: { type: 'number', default: 800 },
              },
              required: ['command'],
            },
            format: {
              type: 'string',
              enum: ['mp4', 'gif'],
              default: 'mp4',
              description: 'Output format: mp4 or gif',
            },
            annotate: {
              type: 'boolean',
              default: true,
              description: 'Whether to run AI annotation',
            },
          },
          required: ['project_dir'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== TOOL_NAME) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const args = request.params.arguments as {
      project_dir: string;
      scenario?: string;
      backend?: 'vhs' | 'browser';
      adhoc?: {
        command: string;
        steps?: Array<{ action: string; value: string; text?: string; pause?: string }>;
        width?: number;
        height?: number;
      };
      format?: 'mp4' | 'gif';
      annotate?: boolean;
    };

    try {
      if (args.adhoc) {
        const result = await handleAdhocMcp({
          project_dir: args.project_dir,
          adhoc: args.adhoc,
          format: args.format,
          annotate: args.annotate,
          backend: args.backend,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      const loaded = await loadConfig(resolve(args.project_dir, 'demo-recorder.yaml'));
      const config = {
        ...loaded,
        annotation: {
          ...loaded.annotation,
          ...(args.annotate === false && { enabled: false }),
        },
        recording: {
          ...loaded.recording,
          ...(args.format === 'gif' && { format: 'gif' as const }),
          ...(args.backend && { backend: args.backend }),
        },
      };

      const backend = args.backend ?? config.recording.backend;

      if (backend === 'browser') {
        return await handleBrowserMcpRecord(config, args);
      }

      return await handleVhsMcpRecord(config, args);
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function handleVhsMcpRecord(config: any, args: { project_dir: string; scenario?: string }) {
  const scenarios = args.scenario
    ? [findScenario(config, args.scenario)]
    : config.scenarios;

  const useParallel = scenarios.length > 1;
  const results = await Promise.all(
    scenarios.map((scenario: any) =>
      record({
        config,
        scenario,
        projectDir: args.project_dir,
        logger: mcpLogger,
        skipSymlinkUpdate: useParallel,
      }),
    ),
  );

  if (useParallel) {
    const timestamp = basename(dirname(dirname(results[0].reportPath)));
    await updateLatestSymlink(args.project_dir, config.output.dir, timestamp);

    const sessionDir = dirname(dirname(results[0].reportPath));
    const sessionPath = join(sessionDir, 'session-report.json');
    const reports = await Promise.all(
      results.map(async (r: any) => JSON.parse(await readFile(r.reportPath, 'utf-8'))),
    );
    await writeSessionReport(sessionPath, config.project.name, reports);
  }

  const response = results.length === 1
    ? {
        success: true,
        video_path: results[0].videoPath,
        raw_video_path: results[0].rawVideoPath,
        report_path: results[0].reportPath,
        thumbnail_path: results[0].thumbnailPath,
        summary: results[0].summary,
      }
    : {
        success: true,
        session_report_path: join(dirname(dirname(results[0].reportPath)), 'session-report.json'),
        recordings: results.map((r: any) => ({
          video_path: r.videoPath,
          report_path: r.reportPath,
          summary: r.summary,
        })),
      };

  return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
}

async function handleBrowserMcpRecord(config: any, args: { project_dir: string; scenario?: string }) {
  const browserScenarios: BrowserScenario[] = args.scenario
    ? [config.browser_scenarios.find((s: BrowserScenario) => s.name === args.scenario)]
    : config.browser_scenarios;

  if (args.scenario && !browserScenarios[0]) {
    throw new Error(`Browser scenario "${args.scenario}" not found`);
  }

  const useParallel = browserScenarios.length > 1;
  const results = await Promise.all(
    browserScenarios.map((scenario) =>
      recordBrowser({
        config,
        scenario,
        projectDir: args.project_dir,
        logger: mcpLogger,
        skipSymlinkUpdate: useParallel,
      }),
    ),
  );

  if (useParallel) {
    const timestamp = basename(dirname(dirname(results[0].reportPath)));
    await updateLatestSymlink(args.project_dir, config.output.dir, timestamp);

    const sessionDir = dirname(dirname(results[0].reportPath));
    const sessionPath = join(sessionDir, 'session-report.json');
    const reports = await Promise.all(
      results.map(async (r) => JSON.parse(await readFile(r.reportPath, 'utf-8'))),
    );
    await writeSessionReport(sessionPath, config.project.name, reports);
  }

  const response = results.length === 1
    ? {
        success: true,
        video_path: results[0].videoPath,
        raw_video_path: results[0].rawVideoPath,
        report_path: results[0].reportPath,
        thumbnail_path: results[0].thumbnailPath,
        summary: results[0].summary,
      }
    : {
        success: true,
        session_report_path: join(dirname(dirname(results[0].reportPath)), 'session-report.json'),
        recordings: results.map((r) => ({
          video_path: r.videoPath,
          report_path: r.reportPath,
          summary: r.summary,
        })),
      };

  return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
}

async function handleAdhocMcp(args: {
  project_dir: string;
  adhoc: {
    command: string;
    steps?: Array<{ action: string; value: string; text?: string; pause?: string }>;
    width?: number;
    height?: number;
  };
  format?: 'mp4' | 'gif';
  annotate?: boolean;
  backend?: 'vhs' | 'browser';
}) {
  if (args.backend === 'browser') {
    const config = buildAdhocConfig({
      command: args.adhoc.command,
      width: args.adhoc.width,
      height: args.adhoc.height,
      format: args.format,
      annotate: args.annotate,
      backend: 'browser',
    });

    const browserSteps = (args.adhoc.steps ?? []).map((s) => ({
      action: s.action as any,
      value: s.value,
      text: s.text,
      pause: s.pause ?? '500ms',
    }));

    const scenario: BrowserScenario = {
      name: 'adhoc-browser',
      description: `Ad-hoc browser recording: ${args.adhoc.command}`,
      url: args.adhoc.command,
      setup: [],
      steps: browserSteps,
      tags: [],
      depends_on: [],
    };

    return recordBrowser({ config, scenario, projectDir: args.project_dir, logger: mcpLogger });
  }

  const steps = args.adhoc.steps?.map((s) => ({
    action: s.action as 'type' | 'key' | 'sleep',
    value: s.value,
    pause: s.pause ?? '500ms',
  }));

  const config = buildAdhocConfig({
    command: args.adhoc.command,
    steps,
    width: args.adhoc.width,
    height: args.adhoc.height,
    format: args.format,
    annotate: args.annotate,
  });
  const scenario = buildAdhocScenario(args.adhoc.command, steps);

  return record({ config, scenario, projectDir: args.project_dir, logger: mcpLogger });
}
