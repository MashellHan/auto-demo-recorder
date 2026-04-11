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
  recordBrowser: vi.fn().mockResolvedValue({
    success: true,
    videoPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/homepage/annotated.mp4',
    rawVideoPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/homepage/raw.webm',
    reportPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/homepage/report.json',
    thumbnailPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/homepage/thumb.png',
    summary: {
      status: 'ok',
      durationSeconds: 5,
      framesAnalyzed: 3,
      bugsFound: 0,
      featuresDemo: ['homepage'],
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

  it('uses findScenario when scenario name is provided', async () => {
    const { findScenario } = await import('../src/config/loader.js');
    const { record } = await import('../src/index.js');

    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: { project_dir: '/tmp/project', scenario: 'basic' },
      },
    });

    // findScenario should have been called with the scenario name
    expect(vi.mocked(findScenario)).toHaveBeenCalledWith(
      expect.objectContaining({ scenarios: expect.any(Array) }),
      'basic',
    );
    // record should be called with a single scenario (not all)
    expect(vi.mocked(record)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(record).mock.calls[0][0].scenario.name).toBe('basic');
    // Single scenario should NOT set skipSymlinkUpdate
    expect(vi.mocked(record).mock.calls[0][0].skipSymlinkUpdate).toBe(false);
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

  it('handles browser recording via backend flag', async () => {
    const { loadConfig } = await import('../src/config/loader.js');
    const { recordBrowser } = await import('../src/index.js');

    vi.mocked(loadConfig).mockResolvedValueOnce({
      project: { name: 'web-test', description: 'Web' },
      recording: { width: 1280, height: 720, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60, backend: 'browser', browser: { headless: true, browser: 'chromium', viewport_width: 1280, viewport_height: 720, timeout_ms: 30000, device_scale_factor: 1, record_video: true } },
      output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
      annotation: { enabled: false, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
      scenarios: [],
      browser_scenarios: [{ name: 'homepage', description: 'Homepage', url: 'http://localhost:3000', setup: [], steps: [] }],
    } as never);

    vi.mocked(recordBrowser).mockResolvedValueOnce({
      success: true,
      videoPath: '/out/annotated.mp4',
      rawVideoPath: '/out/raw.webm',
      reportPath: '/out/2026/homepage/report.json',
      thumbnailPath: '/out/thumb.png',
      summary: { status: 'ok', durationSeconds: 5, framesAnalyzed: 3, bugsFound: 0, featuresDemo: ['home'], description: 'ok' },
    } as never);

    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: { project_dir: '/tmp/project', backend: 'browser' },
      },
    }) as { content: Array<{ type: string; text: string }> };

    expect(vi.mocked(recordBrowser)).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(recordBrowser).mock.calls[0][0] as any;
    expect(callArgs.scenario.name).toBe('homepage');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.video_path).toContain('annotated.mp4');
  });

  it('handles browser scenario not found error', async () => {
    const { loadConfig } = await import('../src/config/loader.js');

    vi.mocked(loadConfig).mockResolvedValueOnce({
      project: { name: 'web-test', description: 'Web' },
      recording: { width: 1280, height: 720, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60, backend: 'browser', browser: { headless: true, browser: 'chromium', viewport_width: 1280, viewport_height: 720, timeout_ms: 30000, device_scale_factor: 1, record_video: true } },
      output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
      annotation: { enabled: false, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
      scenarios: [],
      browser_scenarios: [],
    } as never);

    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: { project_dir: '/tmp/project', backend: 'browser', scenario: 'nonexistent' },
      },
    }) as { content: Array<{ type: string; text: string }>; isError: boolean };

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('not found');
  });

  it('handles multi-scenario browser recording with session report', async () => {
    const { loadConfig } = await import('../src/config/loader.js');
    const { recordBrowser, updateLatestSymlink, writeSessionReport } = await import('../src/index.js');

    vi.mocked(loadConfig).mockResolvedValueOnce({
      project: { name: 'web-test', description: 'Web' },
      recording: { width: 1280, height: 720, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60, backend: 'browser', browser: { headless: true, browser: 'chromium', viewport_width: 1280, viewport_height: 720, timeout_ms: 30000, device_scale_factor: 1, record_video: true } },
      output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
      annotation: { enabled: false, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
      scenarios: [],
      browser_scenarios: [
        { name: 'homepage', description: 'Homepage', url: 'http://localhost:3000', setup: [], steps: [] },
        { name: 'dashboard', description: 'Dashboard', url: 'http://localhost:3000/dash', setup: [], steps: [] },
      ],
    } as never);

    vi.mocked(recordBrowser).mockResolvedValue({
      success: true,
      videoPath: '/out/annotated.mp4',
      rawVideoPath: '/out/raw.webm',
      reportPath: '/tmp/project/.demo-recordings/2026-04-11_07-30/homepage/report.json',
      thumbnailPath: '/out/thumb.png',
      summary: { status: 'ok', durationSeconds: 5, framesAnalyzed: 3, bugsFound: 0, featuresDemo: ['home'], description: 'ok' },
    } as never);

    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: { project_dir: '/tmp/project', backend: 'browser' },
      },
    }) as { content: Array<{ type: string; text: string }> };

    // 2 scenarios → 2 recordBrowser calls
    expect(vi.mocked(recordBrowser).mock.calls.length).toBe(2);
    expect(vi.mocked(recordBrowser).mock.calls[0][0].skipSymlinkUpdate).toBe(true);

    // updateLatestSymlink + writeSessionReport called for multi-scenario
    expect(vi.mocked(updateLatestSymlink)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeSessionReport)).toHaveBeenCalledTimes(1);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.session_report_path).toContain('session-report.json');
    expect(parsed.recordings).toHaveLength(2);
  });

  it('handles adhoc browser recording via MCP', async () => {
    const { recordBrowser } = await import('../src/index.js');

    vi.mocked(recordBrowser).mockResolvedValueOnce({
      success: true,
      videoPath: '/out/annotated.mp4',
      rawVideoPath: '/out/raw.webm',
      reportPath: '/out/report.json',
      thumbnailPath: '/out/thumb.png',
      summary: { status: 'ok', durationSeconds: 5, framesAnalyzed: 0, bugsFound: 0, featuresDemo: [], description: 'ok' },
    } as never);

    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    const result = await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: {
          project_dir: '/tmp/project',
          backend: 'browser',
          adhoc: {
            command: 'http://localhost:3000',
            steps: [
              { action: 'click', value: '.btn' },
              { action: 'fill', value: '#input', text: 'hello' },
            ],
            width: 1920,
            height: 1080,
          },
        },
      },
    }) as { content: Array<{ type: string; text: string }> };

    expect(vi.mocked(recordBrowser)).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(recordBrowser).mock.calls[0][0] as any;
    expect(callArgs.scenario.name).toBe('adhoc-browser');
    expect(callArgs.scenario.url).toBe('http://localhost:3000');
    expect(callArgs.scenario.steps).toHaveLength(2);
    expect(callArgs.scenario.steps[0]).toEqual({ action: 'click', value: '.btn', text: undefined, pause: '500ms' });
    expect(callArgs.scenario.steps[1]).toEqual({ action: 'fill', value: '#input', text: 'hello', pause: '500ms' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
  });

  it('handles adhoc browser recording with no steps', async () => {
    const { recordBrowser } = await import('../src/index.js');

    vi.mocked(recordBrowser).mockResolvedValueOnce({
      success: true,
      videoPath: '/out/annotated.mp4',
      rawVideoPath: '/out/raw.webm',
      reportPath: '/out/report.json',
      thumbnailPath: '/out/thumb.png',
      summary: { status: 'ok', durationSeconds: 5, framesAnalyzed: 0, bugsFound: 0, featuresDemo: [], description: 'ok' },
    } as never);

    await startMcpServer();
    const callHandler = handlers.get('tools/call')!;
    await callHandler({
      params: {
        name: 'demo_recorder_record',
        arguments: {
          project_dir: '/tmp/project',
          backend: 'browser',
          adhoc: { command: 'http://localhost:3000' },
        },
      },
    });

    const callArgs = vi.mocked(recordBrowser).mock.calls[0][0] as any;
    expect(callArgs.scenario.steps).toHaveLength(0);
    expect(callArgs.scenario.url).toBe('http://localhost:3000');
  });
});
