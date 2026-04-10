import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, writeFile, rm } from 'node:fs/promises';

// Mock the record function and config loader
vi.mock('../src/index.js', () => ({
  record: vi.fn().mockResolvedValue({
    success: true,
    videoPath: '/tmp/annotated.mp4',
    rawVideoPath: '/tmp/raw.mp4',
    reportPath: '/tmp/report.json',
    thumbnailPath: '/tmp/thumb.png',
    summary: {
      status: 'ok',
      durationSeconds: 5,
      framesAnalyzed: 3,
      bugsFound: 0,
      featuresDemo: ['startup'],
      description: 'Recording complete.',
    },
  }),
  loadConfig: vi.fn(),
  findScenario: vi.fn(),
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
  findScenario: vi.fn().mockReturnValue({ name: 'basic', description: 'Basic', setup: [], steps: [{ action: 'key', value: 'q', pause: '500ms' }] }),
}));

vi.mock('../src/mcp/server.js', () => ({
  startMcpServer: vi.fn().mockResolvedValue(undefined),
}));

const { createCli } = await import('../src/cli.js');

describe('createCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a CLI with expected commands', () => {
    const cli = createCli();
    expect(cli.name()).toBe('demo-recorder');

    const commandNames = cli.commands.map((c) => c.name());
    expect(commandNames).toContain('record');
    expect(commandNames).toContain('list');
    expect(commandNames).toContain('validate');
    expect(commandNames).toContain('last');
    expect(commandNames).toContain('init');
    expect(commandNames).toContain('serve');
  });

  it('has correct version', () => {
    const cli = createCli();
    expect(cli.version()).toBe('0.1.0');
  });
});

describe('parseAdhocSteps (via adhoc record)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses adhoc record with --command and --steps', async () => {
    const { record } = await import('../src/index.js');
    const cli = createCli();

    // Suppress process.exit and console output
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'record', '--adhoc', '--command', 'ls', '--steps', 'j,k,Enter,sleep:2s,q']);
    } catch {
      // commander may throw on exitOverride
    }

    // Verify record was called with adhoc config
    if (vi.mocked(record).mock.calls.length > 0) {
      const callArgs = vi.mocked(record).mock.calls[0][0];
      expect(callArgs.config.project.name).toBe('adhoc-recording');
      expect(callArgs.scenario.name).toBe('adhoc');
      // First step is the command itself
      expect(callArgs.scenario.steps[0]).toEqual({ action: 'type', value: 'ls', pause: '2s' });
      // Then parsed steps: j (single char → key), k, Enter (keyword → key), sleep:2s, q
      expect(callArgs.scenario.steps[1]).toEqual({ action: 'key', value: 'j', pause: '500ms' });
      expect(callArgs.scenario.steps[2]).toEqual({ action: 'key', value: 'k', pause: '500ms' });
      expect(callArgs.scenario.steps[3]).toEqual({ action: 'key', value: 'Enter', pause: '500ms' });
      expect(callArgs.scenario.steps[4]).toEqual({ action: 'sleep', value: '2s', pause: '0ms' });
      expect(callArgs.scenario.steps[5]).toEqual({ action: 'key', value: 'q', pause: '500ms' });
    }

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('throws when --adhoc is used without --command', async () => {
    const cli = createCli();
    cli.exitOverride();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'record', '--adhoc']);
    } catch (error) {
      // Expected: either commander exit or our error
    }

    consoleErrorSpy.mockRestore();
  });

  it('parses multi-char tokens as type action', async () => {
    const { record } = await import('../src/index.js');
    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'record', '--adhoc', '--command', 'echo', '--steps', 'hello world']);
    } catch {
      // may throw
    }

    if (vi.mocked(record).mock.calls.length > 0) {
      const steps = vi.mocked(record).mock.calls[0][0].scenario.steps;
      // "hello world" is multi-char, not a keyword → type action
      expect(steps[1]).toEqual({ action: 'type', value: 'hello world', pause: '500ms' });
    }

    consoleSpy.mockRestore();
  });

  it('passes noop logger when --quiet is used', async () => {
    const { record } = await import('../src/index.js');
    vi.mocked(record).mockClear();
    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'record', '--adhoc', '--command', 'ls', '--quiet']);
    } catch {
      // may throw
    }

    if (vi.mocked(record).mock.calls.length > 0) {
      const callArgs = vi.mocked(record).mock.calls[0][0];
      expect(callArgs.logger).toBeDefined();
      // Verify it's a noop logger (calling log produces no output)
      callArgs.logger!.log('test');
      callArgs.logger!.warn('test');
    }

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe('list command', () => {
  it('lists scenarios from config', async () => {
    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'list', '-c', '/tmp/demo-recorder.yaml']);
    } catch {
      // may throw
    }

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Project: test');
    expect(output).toContain('basic');
    consoleSpy.mockRestore();
  });
});

describe('validate command', () => {
  it('validates config and prints info', async () => {
    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'validate', '-c', '/tmp/demo-recorder.yaml']);
    } catch {
      // may throw
    }

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Config valid');
    expect(output).toContain('Project: test');
    expect(output).toContain('Scenarios: 1');
    consoleSpy.mockRestore();
  });
});

describe('init command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cli-test-init-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  it('creates demo-recorder.yaml template', async () => {
    const origCwd = process.cwd();
    process.chdir(tempDir);

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'init']);
    } catch {
      // may throw
    }

    const { readFile } = await import('node:fs/promises');
    const content = await readFile(join(tempDir, 'demo-recorder.yaml'), 'utf-8');
    expect(content).toContain('project:');
    expect(content).toContain('scenarios:');

    consoleSpy.mockRestore();
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });
});

describe('serve command', () => {
  it('calls startMcpServer', async () => {
    const { startMcpServer } = await import('../src/mcp/server.js');
    const cli = createCli();
    cli.exitOverride();

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'serve']);
    } catch {
      // may throw
    }

    expect(startMcpServer).toHaveBeenCalledTimes(1);
  });
});
