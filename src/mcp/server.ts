import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, findScenario } from '../config/loader.js';
import { record } from '../index.js';
import { resolve } from 'node:path';
import type { Step, Config, Scenario } from '../config/schema.js';

const TOOL_NAME = 'demo_recorder_record';

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'demo-recorder', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAME,
        description:
          'Record a terminal demo video of a CLI/TUI project. Runs the project, captures a video, and uses AI to annotate it with feature descriptions and bug detection.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            project_dir: {
              type: 'string',
              description: 'Path to the project directory containing demo-recorder.yaml',
            },
            scenario: {
              type: 'string',
              description: 'Name of scenario to record (from config). If omitted, records all.',
            },
            adhoc: {
              type: 'object',
              description: 'Ad-hoc recording without config file',
              properties: {
                command: { type: 'string', description: 'Command to run' },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      action: { type: 'string', enum: ['type', 'key', 'sleep'] },
                      value: { type: 'string' },
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
      adhoc?: {
        command: string;
        steps?: Array<{ action: 'type' | 'key' | 'sleep'; value: string; pause?: string }>;
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
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      const config = await loadConfig(resolve(args.project_dir, 'demo-recorder.yaml'));
      if (args.annotate === false) {
        config.annotation.enabled = false;
      }
      if (args.format === 'gif') {
        config.recording.format = 'gif';
      }

      const scenarios = args.scenario
        ? [findScenario(config, args.scenario)]
        : config.scenarios;

      const results = [];
      for (const scenario of scenarios) {
        const result = await record({ config, scenario, projectDir: args.project_dir });
        results.push(result);
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
            recordings: results.map((r) => ({
              video_path: r.videoPath,
              report_path: r.reportPath,
              summary: r.summary,
            })),
          };

      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
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

async function handleAdhocMcp(args: {
  project_dir: string;
  adhoc: {
    command: string;
    steps?: Array<{ action: 'type' | 'key' | 'sleep'; value: string; pause?: string }>;
    width?: number;
    height?: number;
  };
  format?: 'mp4' | 'gif';
  annotate?: boolean;
}) {
  const steps: Step[] = [
    { action: 'type', value: args.adhoc.command, pause: '2s' },
  ];

  if (args.adhoc.steps) {
    for (const s of args.adhoc.steps) {
      steps.push({ action: s.action, value: s.value, pause: s.pause ?? '500ms' });
    }
  }

  const config: Config = {
    project: { name: 'adhoc-recording', description: 'Ad-hoc MCP recording' },
    recording: {
      width: args.adhoc.width ?? 1200,
      height: args.adhoc.height ?? 800,
      font_size: 16,
      theme: 'Catppuccin Mocha',
      fps: 25,
      max_duration: 60,
      format: args.format === 'gif' ? 'gif' : 'mp4',
    },
    output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
    annotation: {
      enabled: args.annotate !== false,
      model: 'claude-sonnet-4-6',
      extract_fps: 1,
      language: 'en',
      overlay_position: 'bottom',
      overlay_font_size: 14,
    },
    scenarios: [],
  };

  const scenario: Scenario = {
    name: 'adhoc',
    description: `Ad-hoc: ${args.adhoc.command}`,
    setup: [],
    steps,
  };

  return record({ config, scenario, projectDir: args.project_dir });
}
