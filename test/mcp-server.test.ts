import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Config, Scenario, Step } from '../src/config/schema.js';

// Mock the record function
vi.mock('../src/index.js', () => ({
  record: vi.fn().mockResolvedValue({
    success: true,
    videoPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/basic/annotated.mp4',
    rawVideoPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/basic/raw.mp4',
    reportPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/basic/report.json',
    thumbnailPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/basic/thumb.png',
    summary: {
      status: 'ok',
      durationSeconds: 5,
      framesAnalyzed: 3,
      bugsFound: 0,
      featuresDemo: ['startup'],
      description: 'Recording complete.',
    },
  }),
  updateLatestSymlink: vi.fn().mockResolvedValue(undefined),
  writeSessionReport: vi.fn().mockResolvedValue({
    project: 'test',
    timestamp: '2026-04-11T00:00:00Z',
    scenarios_recorded: 2,
    overall_status: 'ok',
    total_bugs: 0,
    total_duration_seconds: 10,
    scenarios: [],
  }),
}));

vi.mock('../src/config/loader.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    project: { name: 'test', description: 'Test' },
    recording: { width: 1200, height: 800, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60 },
    output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
    annotation: { enabled: true, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
    scenarios: [
      { name: 'basic', description: 'Basic', setup: [], steps: [{ action: 'key', value: 'q', pause: '500ms' }] },
    ],
  }),
  findScenario: vi.fn().mockReturnValue({
    name: 'basic',
    description: 'Basic',
    setup: [],
    steps: [{ action: 'key', value: 'q', pause: '500ms' }],
  }),
}));

// Mock MCP SDK to avoid actual stdio transport
const mockConnect = vi.fn().mockResolvedValue(undefined);
const handlers = new Map<string, (request: unknown) => Promise<unknown>>();
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    setRequestHandler: vi.fn((schema: { method: string }, handler: (request: unknown) => Promise<unknown>) => {
      handlers.set(schema.method, handler);
    }),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: { method: 'tools/call' },
  ListToolsRequestSchema: { method: 'tools/list' },
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    readFile: vi.fn().mockResolvedValue(JSON.stringify({
      project: 'test',
      scenario: 'basic',
      timestamp: '2026-04-11T00:00:00Z',
      duration_seconds: 5,
      total_frames_analyzed: 3,
      overall_status: 'ok',
      frames: [],
      summary: 'Recording complete.',
      bugs_found: 0,
    })),
  };
});

const { startMcpServer } = await import('../src/mcp/server.js');

describe('MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
  });

  it('starts server and registers handlers', async () => {
    await startMcpServer();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(handlers.has('tools/list')).toBe(true);
    expect(handlers.has('tools/call')).toBe(true);
  });

  it('lists the demo_recorder_record tool', async () => {
    await startMcpServer();
    const listHandler = handlers.get('tools/list')!;
    const result = await listHandler({}) as { tools: Array<{ name: string }> };
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('demo_recorder_record');
  });

  it('handles config-based record call', async () => {
    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: { project_dir: '/tmp/project' },
      },
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.video_path).toContain('annotated.mp4');
  });

  it('handles adhoc record call', async () => {
    const { record } = await import('../src/index.js');
    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: {
          project_dir: '/tmp/project',
          adhoc: { command: 'ls -la', steps: [{ action: 'key', value: 'q' }] },
        },
      },
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0].type).toBe('text');
    // Verify record was called with adhoc config
    expect(vi.mocked(record).mock.calls.length).toBeGreaterThan(0);
    const callArgs = vi.mocked(record).mock.calls[0][0];
    expect(callArgs.config.project.name).toBe('adhoc-recording');
    expect(callArgs.scenario.steps[0].value).toBe('ls -la');
  });

  it('adhoc applies default pause to steps without pause', async () => {
    const { record } = await import('../src/index.js');
    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: {
          project_dir: '/tmp/project',
          adhoc: {
            command: './my-tui',
            steps: [
              { action: 'key', value: 'j' },
              { action: 'key', value: 'q', pause: '1s' },
            ],
          },
        },
      },
    });

    const callArgs = vi.mocked(record).mock.calls[0][0];
    // First step is the command itself (type), then the user steps
    expect(callArgs.scenario.steps[1]).toEqual({ action: 'key', value: 'j', pause: '500ms' });
    expect(callArgs.scenario.steps[2]).toEqual({ action: 'key', value: 'q', pause: '1s' });
  });

  it('adhoc passes format and annotate through to config', async () => {
    const { record } = await import('../src/index.js');
    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: {
          project_dir: '/tmp/project',
          adhoc: { command: './my-tui' },
          format: 'gif',
          annotate: false,
        },
      },
    });

    const callArgs = vi.mocked(record).mock.calls[0][0];
    expect(callArgs.config.recording.format).toBe('gif');
    expect(callArgs.config.annotation.enabled).toBe(false);
  });

  it('adhoc with no steps records command only', async () => {
    const { record } = await import('../src/index.js');
    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: {
          project_dir: '/tmp/project',
          adhoc: { command: 'htop' },
        },
      },
    });

    const callArgs = vi.mocked(record).mock.calls[0][0];
    // Only the type command step, no user steps
    expect(callArgs.scenario.steps).toHaveLength(1);
    expect(callArgs.scenario.steps[0]).toEqual({ action: 'type', value: 'htop', pause: '2s' });
  });

  it('throws for unknown tool', async () => {
    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;

    await expect(
      callHandler({
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      }),
    ).rejects.toThrow('Unknown tool: unknown_tool');
  });

  it('passes skipSymlinkUpdate for parallel multi-scenario recording', async () => {
    const { loadConfig } = await import('../src/config/loader.js');
    const { record, updateLatestSymlink, writeSessionReport } = await import('../src/index.js');

    // Mock config with 2 scenarios to trigger parallel mode
    vi.mocked(loadConfig).mockResolvedValueOnce({
      project: { name: 'test', description: 'Test' },
      recording: { width: 1200, height: 800, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60 },
      output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
      annotation: { enabled: true, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
      scenarios: [
        { name: 'basic', description: 'Basic', setup: [], steps: [{ action: 'key', value: 'q', pause: '500ms' }] },
        { name: 'advanced', description: 'Advanced', setup: [], steps: [{ action: 'type', value: 'hello', pause: '1s' }] },
      ],
    } as never);

    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: { project_dir: '/tmp/project' },
      },
    }) as { content: Array<{ type: string; text: string }> };

    // With 2 scenarios, record should be called with skipSymlinkUpdate: true
    expect(vi.mocked(record).mock.calls.length).toBe(2);
    expect(vi.mocked(record).mock.calls[0][0].skipSymlinkUpdate).toBe(true);
    expect(vi.mocked(record).mock.calls[1][0].skipSymlinkUpdate).toBe(true);

    // updateLatestSymlink should be called once after Promise.all with the correct timestamp
    expect(vi.mocked(updateLatestSymlink)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateLatestSymlink)).toHaveBeenCalledWith(
      '/tmp/project',
      '.demo-recordings',
      '2026-04-11_07-30',
    );

    // writeSessionReport should be called for multi-scenario
    expect(vi.mocked(writeSessionReport)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeSessionReport)).toHaveBeenCalledWith(
      expect.stringContaining('session-report.json'),
      'test',
      expect.any(Array),
    );

    // Response should have multi-scenario format with session_report_path
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.session_report_path).toContain('session-report.json');
    expect(parsed.recordings).toHaveLength(2);
    expect(parsed.recordings[0].video_path).toContain('annotated.mp4');
    expect(parsed.recordings[0].report_path).toContain('report.json');
    expect(parsed.recordings[0].summary).toBeDefined();
  });

  it('returns error response when record throws', async () => {
    const { record } = await import('../src/index.js');
    vi.mocked(record).mockRejectedValueOnce(new Error('VHS not installed'));

    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: { project_dir: '/tmp/project' },
      },
    }) as { content: Array<{ type: string; text: string }>; isError: boolean };

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('VHS not installed');
  });

  it('returns single-scenario response format for one scenario', async () => {
    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: { project_dir: '/tmp/project' },
      },
    }) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.video_path).toContain('annotated.mp4');
    expect(parsed.raw_video_path).toContain('raw.mp4');
    expect(parsed.report_path).toContain('report.json');
    expect(parsed.thumbnail_path).toContain('thumb.png');
    expect(parsed.summary.status).toBe('ok');
    // Should NOT have multi-scenario fields
    expect(parsed.session_report_path).toBeUndefined();
    expect(parsed.recordings).toBeUndefined();
  });
});
