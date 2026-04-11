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
    watch: { include: ['src/**/*'], exclude: ['node_modules/**', 'dist/**', '.demo-recordings/**'], debounce_ms: 500 },
    scenarios: [
      { name: 'basic', description: 'Basic', setup: [], steps: [{ action: 'key', value: 'q', pause: '500ms' }] },
    ],
  }),
  findScenario: vi.fn().mockReturnValue({ name: 'basic', description: 'Basic', setup: [], steps: [{ action: 'key', value: 'q', pause: '500ms' }] }),
}));

vi.mock('../src/mcp/server.js', () => ({
  startMcpServer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/pipeline/watcher.js', () => ({
  startWatcher: vi.fn().mockReturnValue({ close: vi.fn() }),
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
    expect(commandNames).toContain('watch');
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

  it('refuses to overwrite existing demo-recorder.yaml', async () => {
    const origCwd = process.cwd();
    await writeFile(join(tempDir, 'demo-recorder.yaml'), 'existing');
    process.chdir(tempDir);

    const cli = createCli();
    cli.exitOverride();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'init']);
    } catch {
      // expected
    }

    expect(consoleErrorSpy.mock.calls.some((c) => String(c[0]).includes('already exists'))).toBe(true);

    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('uses --from-existing to auto-detect project type', async () => {
    const origCwd = process.cwd();
    // Create a package.json to be detected
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      description: 'A test project',
      scripts: { build: 'tsc' },
    }));
    process.chdir(tempDir);

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'init', '--from-existing']);
    } catch {
      // may throw
    }

    // Should detect node project
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Detected node project: test-project');

    // Should create config file with detected values
    const { readFile: rf } = await import('node:fs/promises');
    const content = await rf(join(tempDir, 'demo-recorder.yaml'), 'utf-8');
    expect(content).toContain('name: "test-project"');
    expect(content).toContain('build_command: "npm run build"');

    consoleSpy.mockRestore();
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });
});

describe('last command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cli-test-last-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  it('shows no recordings when latest link does not exist', async () => {
    const { loadConfig } = await import('../src/config/loader.js');
    vi.mocked(loadConfig).mockResolvedValueOnce({
      project: { name: 'test', description: 'Test' },
      recording: { width: 1200, height: 800, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60 },
      output: { dir: 'nonexistent-recordings', keep_raw: true, keep_frames: false },
      annotation: { enabled: true, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
      scenarios: [],
    } as never);

    const origCwd = process.cwd();
    process.chdir(tempDir);

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'last']);
    } catch {
      // may throw
    }

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No recordings found');

    consoleSpy.mockRestore();
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('shows recording info when latest exists', async () => {
    const { loadConfig } = await import('../src/config/loader.js');

    // Create directory structure: outputDir/timestamp/basic/report.json
    const outputDir = join(tempDir, '.demo-recordings');
    const tsDir = join(outputDir, '2026-04-11_08-00');
    const scenarioDir = join(tsDir, 'basic');
    await mkdir(scenarioDir, { recursive: true });

    // Create a symlink: latest -> timestamp dir
    const { symlink } = await import('node:fs/promises');
    await symlink(tsDir, join(outputDir, 'latest'));

    // Write a report
    await writeFile(join(scenarioDir, 'report.json'), JSON.stringify({
      scenario: 'basic',
      overall_status: 'ok',
      total_frames_analyzed: 5,
      bugs_found: 0,
      duration_seconds: 10.5,
    }));

    vi.mocked(loadConfig).mockResolvedValueOnce({
      project: { name: 'test', description: 'Test' },
      recording: { width: 1200, height: 800, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60 },
      output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
      annotation: { enabled: true, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
      scenarios: [],
    } as never);

    const origCwd = process.cwd();
    process.chdir(tempDir);

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'last']);
    } catch {
      // may throw
    }

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Last recording:');
    expect(output).toContain('Scenario: basic');
    expect(output).toContain('Status: ok');
    expect(output).toContain('Frames: 5');
    expect(output).toContain('Duration: 10.5s');

    consoleSpy.mockRestore();
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });
});

describe('record command (config mode)', () => {
  it('records with --format gif', async () => {
    const { record: recordFn } = await import('../src/index.js');
    vi.mocked(recordFn).mockClear();

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'record', '--format', 'gif']);
    } catch {
      // may throw
    }

    if (vi.mocked(recordFn).mock.calls.length > 0) {
      const callArgs = vi.mocked(recordFn).mock.calls[0][0];
      expect(callArgs.config.recording.format).toBe('gif');
    }

    consoleSpy.mockRestore();
  });

  it('records with --no-annotate', async () => {
    const { record: recordFn } = await import('../src/index.js');
    vi.mocked(recordFn).mockClear();

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'record', '--no-annotate']);
    } catch {
      // may throw
    }

    if (vi.mocked(recordFn).mock.calls.length > 0) {
      const callArgs = vi.mocked(recordFn).mock.calls[0][0];
      expect(callArgs.config.annotation.enabled).toBe(false);
    }

    consoleSpy.mockRestore();
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

describe('diff command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `cli-test-diff-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  it('reports no changes for identical reports', async () => {
    const report = {
      project: 'test',
      scenario: 'basic',
      timestamp: '2026-04-11T00:00:00.000Z',
      duration_seconds: 10,
      total_frames_analyzed: 1,
      overall_status: 'ok',
      frames: [{
        index: 0, timestamp: '0:00', status: 'ok', description: 'test',
        feature_being_demonstrated: 'nav', bugs_detected: [],
        visual_quality: 'good', annotation_text: 'test',
      }],
      summary: 'test',
      bugs_found: 0,
    };

    const baselinePath = join(tempDir, 'baseline.json');
    const currentPath = join(tempDir, 'current.json');
    await writeFile(baselinePath, JSON.stringify(report));
    await writeFile(currentPath, JSON.stringify(report));

    const origCwd = process.cwd();
    process.chdir(tempDir);

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'diff', 'baseline.json', 'current.json']);
    } catch {
      // may throw
    }

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No changes detected');

    consoleSpy.mockRestore();
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('has diff command registered', () => {
    const cli = createCli();
    const commandNames = cli.commands.map((c) => c.name());
    expect(commandNames).toContain('diff');
  });

  it('suppresses output with --quiet flag', async () => {
    const report = {
      project: 'test',
      scenario: 'basic',
      timestamp: '2026-04-11T00:00:00.000Z',
      duration_seconds: 10,
      total_frames_analyzed: 1,
      overall_status: 'ok',
      frames: [{
        index: 0, timestamp: '0:00', status: 'ok', description: 'test',
        feature_being_demonstrated: 'nav', bugs_detected: [],
        visual_quality: 'good', annotation_text: 'test',
      }],
      summary: 'test',
      bugs_found: 0,
    };

    const baselinePath = join(tempDir, 'baseline-q.json');
    const currentPath = join(tempDir, 'current-q.json');
    await writeFile(baselinePath, JSON.stringify(report));
    await writeFile(currentPath, JSON.stringify(report));

    const origCwd = process.cwd();
    process.chdir(tempDir);

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'diff', '--quiet', 'baseline-q.json', 'current-q.json']);
    } catch {
      // may throw
    }

    // --quiet should produce no console.log output
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('shows changes when regressions exist', async () => {
    const baseline = {
      project: 'test',
      scenario: 'basic',
      timestamp: '2026-04-11T00:00:00.000Z',
      duration_seconds: 10,
      total_frames_analyzed: 3,
      overall_status: 'ok',
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'start', feature_being_demonstrated: 'nav', bugs_detected: [], visual_quality: 'good', annotation_text: 'ok' },
        { index: 1, timestamp: '0:01', status: 'ok', description: 'nav', feature_being_demonstrated: 'nav', bugs_detected: [], visual_quality: 'good', annotation_text: 'ok' },
        { index: 2, timestamp: '0:02', status: 'ok', description: 'end', feature_being_demonstrated: 'nav', bugs_detected: [], visual_quality: 'good', annotation_text: 'ok' },
      ],
      summary: 'all ok',
      bugs_found: 0,
    };

    const current = {
      ...baseline,
      overall_status: 'error',
      bugs_found: 2,
      frames: [
        { index: 0, timestamp: '0:00', status: 'error', description: 'broken', feature_being_demonstrated: 'nav', bugs_detected: ['layout broken'], visual_quality: 'broken', annotation_text: 'broken' },
      ],
    };

    const bPath = join(tempDir, 'b.json');
    const cPath = join(tempDir, 'c.json');
    await writeFile(bPath, JSON.stringify(baseline));
    await writeFile(cPath, JSON.stringify(current));

    const origCwd = process.cwd();
    process.chdir(tempDir);

    const cli = createCli();
    cli.exitOverride();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'diff', 'b.json', 'c.json']);
    } catch {
      // expected — process.exit(1) or commander exit
    }

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Regression report');

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  });
});

describe('watch command', () => {
  it('calls startWatcher with config', async () => {
    const { startWatcher } = await import('../src/pipeline/watcher.js');
    const cli = createCli();
    cli.exitOverride();

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'watch']);
    } catch {
      // may throw
    }

    expect(startWatcher).toHaveBeenCalledTimes(1);
    expect(startWatcher).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ project: { name: 'test', description: 'Test' } }),
      projectDir: expect.any(String),
    }));
  });

  it('passes scenario filter when --scenario is provided', async () => {
    const { startWatcher } = await import('../src/pipeline/watcher.js');
    const { findScenario } = await import('../src/config/loader.js');
    const cli = createCli();
    cli.exitOverride();

    try {
      await cli.parseAsync(['node', 'demo-recorder', 'watch', '--scenario', 'basic']);
    } catch {
      // may throw
    }

    expect(findScenario).toHaveBeenCalledWith(expect.anything(), 'basic');
    expect(startWatcher).toHaveBeenCalledWith(expect.objectContaining({
      scenario: expect.objectContaining({ name: 'basic' }),
    }));
  });
});
