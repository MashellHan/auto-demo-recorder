import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all pipeline modules and external deps
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
    cb(null);
    return { stderr: { on: vi.fn() } };
  }),
}));

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    symlink: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    realpath: vi.fn().mockResolvedValue('/tmp/project/.demo-recordings/2026-01-01_12-00'),
    readFile: vi.fn().mockResolvedValue(''),
  };
});

vi.mock('../src/pipeline/tape-builder.js', () => ({
  buildTape: vi.fn().mockReturnValue('Output "/tmp/raw.mp4"\nSet Width 1200\nType "hello"\n'),
}));

vi.mock('../src/pipeline/vhs-runner.js', () => ({
  runVhs: vi.fn().mockResolvedValue({ videoPath: '/tmp/raw.mp4', durationMs: 5000 }),
}));

vi.mock('../src/pipeline/frame-extractor.js', () => ({
  extractFrames: vi.fn().mockResolvedValue({ framesDir: '/tmp/frames', frameCount: 3 }),
}));

vi.mock('../src/pipeline/annotator.js', () => ({
  annotateFrames: vi.fn().mockResolvedValue({
    frames: [
      { index: 0, timestamp: '0:00', status: 'ok', description: 'Frame 1', feature_being_demonstrated: 'startup', bugs_detected: [], visual_quality: 'good', annotation_text: 'Starting' },
    ],
    overall_status: 'ok',
    summary: 'All good.',
    bugs_found: 0,
  }),
}));

vi.mock('../src/pipeline/post-processor.js', () => ({
  postProcess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/pipeline/browser-runner.js', () => ({
  runBrowser: vi.fn().mockResolvedValue({ durationMs: 3000 }),
}));

const { record, recordBrowser } = await import('../src/index.js');

describe('scenario hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const baseConfig = {
    project: { name: 'test-project', description: 'Test project' },
    recording: { width: 1200, height: 800, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60 },
    output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
    annotation: { enabled: false, model: 'claude-sonnet-4-6' as const, extract_fps: 1, language: 'en', overlay_position: 'bottom' as const, overlay_font_size: 14 },
    scenarios: [],
  };

  const baseScenario = {
    name: 'basic',
    description: 'Basic demo',
    setup: [],
    steps: [{ action: 'type' as const, value: 'hello', pause: '1s' }],
    tags: [],
  };

  it('runs before hook before recording starts', async () => {
    const { execFile } = await import('node:child_process');
    const logs: string[] = [];

    await record({
      config: baseConfig,
      scenario: { ...baseScenario, hooks: { before: 'echo setup' } },
      projectDir: '/tmp/project',
      logger: { log: (msg: string) => logs.push(msg), warn: () => {} },
    });

    // execFile should have been called with 'sh', ['-c', 'echo setup']
    const hookCall = vi.mocked(execFile).mock.calls.find(
      (call) => call[0] === 'sh' && (call[1] as string[]).includes('echo setup'),
    );
    expect(hookCall).toBeDefined();
    expect(logs.some((l) => l.includes('before hook'))).toBe(true);
  });

  it('runs after hook after recording finishes', async () => {
    const { execFile } = await import('node:child_process');
    const logs: string[] = [];

    await record({
      config: baseConfig,
      scenario: { ...baseScenario, hooks: { after: 'echo cleanup' } },
      projectDir: '/tmp/project',
      logger: { log: (msg: string) => logs.push(msg), warn: () => {} },
    });

    const hookCall = vi.mocked(execFile).mock.calls.find(
      (call) => call[0] === 'sh' && (call[1] as string[]).includes('echo cleanup'),
    );
    expect(hookCall).toBeDefined();
    expect(logs.some((l) => l.includes('after hook'))).toBe(true);
  });

  it('runs after hook even when recording throws', async () => {
    const { runVhs } = await import('../src/pipeline/vhs-runner.js');
    const { execFile } = await import('node:child_process');

    vi.mocked(runVhs).mockRejectedValueOnce(new Error('VHS crashed'));

    const logs: string[] = [];
    const warns: string[] = [];

    await expect(
      record({
        config: baseConfig,
        scenario: { ...baseScenario, hooks: { after: 'echo cleanup-on-error' } },
        projectDir: '/tmp/project',
        logger: { log: (msg: string) => logs.push(msg), warn: (msg: string) => warns.push(msg) },
      }),
    ).rejects.toThrow('VHS crashed');

    // After hook should still have run
    const hookCall = vi.mocked(execFile).mock.calls.find(
      (call) => call[0] === 'sh' && (call[1] as string[]).includes('echo cleanup-on-error'),
    );
    expect(hookCall).toBeDefined();
  });

  it('throws when before hook fails', async () => {
    const { execFile } = await import('node:child_process');

    vi.mocked(execFile).mockImplementationOnce(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('setup failed'));
        return { stderr: { on: vi.fn() } } as never;
      },
    );

    await expect(
      record({
        config: baseConfig,
        scenario: { ...baseScenario, hooks: { before: 'failing-command' } },
        projectDir: '/tmp/project',
      }),
    ).rejects.toThrow('setup failed');
  });

  it('does not throw when after hook fails', async () => {
    const { execFile } = await import('node:child_process');
    const warns: string[] = [];

    // First call succeeds (for VHS tape/build), then the after hook call fails
    // We need to count calls: record() with no build_command won't call execFile
    // until the after hook. So the first execFile call IS the after hook.
    vi.mocked(execFile).mockImplementation(
      (_cmd: string, _args: unknown[], _opts: unknown, cb: (err: Error | null) => void) => {
        const args = _args as string[];
        if (args.includes('echo after-fail')) {
          cb(new Error('cleanup failed'));
        } else {
          cb(null);
        }
        return { stderr: { on: vi.fn() } } as never;
      },
    );

    const result = await record({
      config: baseConfig,
      scenario: { ...baseScenario, hooks: { after: 'echo after-fail' } },
      projectDir: '/tmp/project',
      logger: { log: () => {}, warn: (msg: string) => warns.push(msg) },
    });

    expect(result.success).toBe(true);
    expect(warns.some((w) => w.includes('after hook failed'))).toBe(true);
  });

  it('skips hooks when not configured', async () => {
    const { execFile } = await import('node:child_process');

    await record({
      config: baseConfig,
      scenario: baseScenario, // no hooks field
      projectDir: '/tmp/project',
    });

    // execFile should NOT have been called for hook commands (no build_command either)
    const hookCalls = vi.mocked(execFile).mock.calls.filter(
      (call) => call[0] === 'sh',
    );
    expect(hookCalls).toHaveLength(0);
  });

  it('runs hooks for browser recording', async () => {
    const { execFile } = await import('node:child_process');
    const logs: string[] = [];

    const browserScenario = {
      name: 'web-demo',
      description: 'Web demo',
      url: 'http://localhost:3000',
      setup: [],
      steps: [{ action: 'navigate' as const, value: 'http://localhost:3000', pause: '500ms' }],
      tags: [],
      hooks: { before: 'npm run dev &', after: 'kill %1' },
    };

    await recordBrowser({
      config: baseConfig,
      scenario: browserScenario,
      projectDir: '/tmp/project',
      logger: { log: (msg: string) => logs.push(msg), warn: () => {} },
    });

    const beforeCall = vi.mocked(execFile).mock.calls.find(
      (call) => call[0] === 'sh' && (call[1] as string[]).includes('npm run dev &'),
    );
    const afterCall = vi.mocked(execFile).mock.calls.find(
      (call) => call[0] === 'sh' && (call[1] as string[]).includes('kill %1'),
    );
    expect(beforeCall).toBeDefined();
    expect(afterCall).toBeDefined();
    expect(logs.some((l) => l.includes('before hook'))).toBe(true);
    expect(logs.some((l) => l.includes('after hook'))).toBe(true);
  });

  it('runs both before and after hooks', async () => {
    const { execFile } = await import('node:child_process');
    const logs: string[] = [];

    await record({
      config: baseConfig,
      scenario: { ...baseScenario, hooks: { before: 'echo start', after: 'echo end' } },
      projectDir: '/tmp/project',
      logger: { log: (msg: string) => logs.push(msg), warn: () => {} },
    });

    const beforeCall = vi.mocked(execFile).mock.calls.find(
      (call) => call[0] === 'sh' && (call[1] as string[]).includes('echo start'),
    );
    const afterCall = vi.mocked(execFile).mock.calls.find(
      (call) => call[0] === 'sh' && (call[1] as string[]).includes('echo end'),
    );
    expect(beforeCall).toBeDefined();
    expect(afterCall).toBeDefined();

    // Before should appear before after in logs
    const beforeIdx = logs.findIndex((l) => l.includes('before hook'));
    const afterIdx = logs.findIndex((l) => l.includes('after hook'));
    expect(beforeIdx).toBeLessThan(afterIdx);
  });
});
