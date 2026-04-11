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
      { index: 1, timestamp: '0:01', status: 'ok', description: 'Frame 2', feature_being_demonstrated: 'navigation', bugs_detected: [], visual_quality: 'good', annotation_text: 'Navigating' },
    ],
    overall_status: 'ok',
    summary: 'Analyzed 2 frames. All good.',
    bugs_found: 0,
  }),
}));

vi.mock('../src/pipeline/post-processor.js', () => ({
  postProcess: vi.fn().mockResolvedValue(undefined),
}));

const { record } = await import('../src/index.js');
const { updateLatestSymlink, formatTimestamp } = await import('../src/index.js');

describe('record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  const baseConfig = {
    project: { name: 'test-project', description: 'Test project' },
    recording: { width: 1200, height: 800, font_size: 16, theme: 'Catppuccin Mocha', fps: 25, max_duration: 60 },
    output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
    annotation: { enabled: true, model: 'claude-sonnet-4-6' as const, extract_fps: 1, language: 'en', overlay_position: 'bottom' as const, overlay_font_size: 14 },
    scenarios: [],
  };

  const baseScenario = {
    name: 'basic',
    description: 'Basic demo',
    setup: [],
    steps: [{ action: 'type' as const, value: 'hello', pause: '1s' }],
  };

  it('runs full pipeline with annotation enabled', async () => {
    const { buildTape } = await import('../src/pipeline/tape-builder.js');
    const { runVhs } = await import('../src/pipeline/vhs-runner.js');
    const { extractFrames } = await import('../src/pipeline/frame-extractor.js');
    const { annotateFrames } = await import('../src/pipeline/annotator.js');
    const { postProcess } = await import('../src/pipeline/post-processor.js');

    const result = await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    expect(buildTape).toHaveBeenCalledTimes(1);
    expect(runVhs).toHaveBeenCalledTimes(1);
    expect(extractFrames).toHaveBeenCalledTimes(1);
    expect(annotateFrames).toHaveBeenCalledTimes(1);
    expect(postProcess).toHaveBeenCalledTimes(1);

    expect(result.success).toBe(true);
    expect(result.summary.status).toBe('ok');
    expect(result.summary.framesAnalyzed).toBe(2);
    expect(result.summary.bugsFound).toBe(0);
    expect(result.summary.featuresDemo).toContain('startup');
    expect(result.summary.featuresDemo).toContain('navigation');
  });

  it('skips annotation when disabled', async () => {
    const { extractFrames } = await import('../src/pipeline/frame-extractor.js');
    const { annotateFrames } = await import('../src/pipeline/annotator.js');
    const { postProcess } = await import('../src/pipeline/post-processor.js');

    const config = {
      ...baseConfig,
      annotation: { ...baseConfig.annotation, enabled: false },
    };

    const result = await record({
      config,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    expect(extractFrames).not.toHaveBeenCalled();
    expect(annotateFrames).not.toHaveBeenCalled();
    expect(postProcess).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.summary.framesAnalyzed).toBe(0);
    expect(result.videoPath).toContain('raw.mp4');
  });

  it('runs build_command when specified', async () => {
    const config = {
      ...baseConfig,
      project: { ...baseConfig.project, build_command: 'make build' },
    };

    const { execFile } = await import('node:child_process');

    await record({
      config,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    expect(execFile).toHaveBeenCalled();
    expect(vi.mocked(execFile).mock.calls[0][0]).toBe('make');
    expect(vi.mocked(execFile).mock.calls[0][1]).toEqual(['build']);
  });

  it('removes frames when keep_frames is false', async () => {
    const { rm } = await import('node:fs/promises');

    await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    expect(rm).toHaveBeenCalledWith(expect.stringContaining('frames'), { recursive: true, force: true });
  });

  it('creates latest symlink', async () => {
    const { symlink } = await import('node:fs/promises');

    await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    expect(symlink).toHaveBeenCalledTimes(1);
  });

  it('handles unlink failure when latest symlink does not exist', async () => {
    const { unlink, symlink } = await import('node:fs/promises');

    // Make unlink throw (symlink doesn't exist yet)
    vi.mocked(unlink).mockRejectedValueOnce(new Error('ENOENT: no such file'));

    await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    // Should still create the symlink despite unlink failure
    expect(symlink).toHaveBeenCalledTimes(1);
  });

  it('writes report JSON', async () => {
    const { writeFile } = await import('node:fs/promises');

    await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    // writeFile is called for the report
    const reportCall = vi.mocked(writeFile).mock.calls.find(
      (call) => (call[0] as string).endsWith('report.json'),
    );
    expect(reportCall).toBeDefined();
    const reportData = JSON.parse(reportCall![1] as string);
    expect(reportData.project).toBe('test-project');
    expect(reportData.scenario).toBe('basic');
    expect(reportData.overall_status).toBe('ok');
  });

  it('uses .gif extension when format is gif', async () => {
    const gifConfig = {
      ...baseConfig,
      recording: { ...baseConfig.recording, format: 'gif' as const },
    };

    const result = await record({
      config: gifConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    expect(result.videoPath).toContain('raw.gif');
    expect(result.rawVideoPath).toContain('raw.gif');
  });

  it('skips post-processing overlay for gif format', async () => {
    const { postProcess } = await import('../src/pipeline/post-processor.js');
    const { extractFrames } = await import('../src/pipeline/frame-extractor.js');
    const { annotateFrames } = await import('../src/pipeline/annotator.js');

    const gifConfig = {
      ...baseConfig,
      recording: { ...baseConfig.recording, format: 'gif' as const },
    };

    await record({
      config: gifConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    // Frames should still be extracted and annotated
    expect(extractFrames).toHaveBeenCalled();
    expect(annotateFrames).toHaveBeenCalled();
    // But post-processing overlay should be skipped for GIF
    expect(postProcess).not.toHaveBeenCalled();
  });

  it('uses custom logger when provided', async () => {
    const logs: string[] = [];
    const customLogger = {
      log: (msg: string) => logs.push(msg),
      warn: (msg: string) => logs.push(`WARN: ${msg}`),
    };

    await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
      logger: customLogger,
    });

    expect(logs.some((l) => l.includes('Recording scenario: basic'))).toBe(true);
    expect(logs.some((l) => l.includes('Tape generated'))).toBe(true);
    expect(logs.some((l) => l.includes('VHS recording complete'))).toBe(true);
  });

  it('suppresses output with noop logger', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const noopLogger = { log: () => {}, warn: () => {} };

    await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
      logger: noopLogger,
    });

    // console.log should NOT have been called by record() since we used noop logger
    // (Note: beforeEach already mocks console.log, so we check it wasn't called for pipeline messages)
    const pipelineCalls = consoleSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('Recording scenario'),
    );
    expect(pipelineCalls).toHaveLength(0);
  });

  it('returns regression info when previous report exists', async () => {
    const { existsSync } = await import('node:fs');
    const { readFile } = await import('node:fs/promises');

    // Make existsSync return true for latest symlink and previous report
    vi.mocked(existsSync).mockReturnValue(true);

    const previousReport = JSON.stringify({
      project: 'test-project',
      scenario: 'basic',
      timestamp: '2026-01-01T00:00:00Z',
      duration_seconds: 5,
      total_frames_analyzed: 2,
      overall_status: 'ok',
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'Frame 1', feature_being_demonstrated: 'startup', bugs_detected: [], visual_quality: 'good', annotation_text: 'Starting' },
      ],
      summary: 'All good.',
      bugs_found: 0,
    });

    const currentReport = JSON.stringify({
      project: 'test-project',
      scenario: 'basic',
      timestamp: '2026-01-02T00:00:00Z',
      duration_seconds: 5,
      total_frames_analyzed: 2,
      overall_status: 'bug_detected',
      frames: [
        { index: 0, timestamp: '0:00', status: 'bug_detected', description: 'Frame 1', feature_being_demonstrated: 'startup', bugs_detected: ['UI glitch'], visual_quality: 'poor', annotation_text: 'Bug found' },
      ],
      summary: 'Bug detected.',
      bugs_found: 1,
    });

    vi.mocked(readFile).mockResolvedValueOnce(previousReport as never).mockResolvedValueOnce(currentReport as never);

    const result = await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    expect(result.regression).toBeDefined();
    expect(result.regression!.has_regressions).toBe(true);
    expect(result.regression!.changes.length).toBeGreaterThan(0);
  });

  it('returns no regression info when no previous report exists', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    expect(result.regression).toBeUndefined();
  });

  it('skips symlink update when skipSymlinkUpdate is true', async () => {
    const { symlink } = await import('node:fs/promises');

    await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
      skipSymlinkUpdate: true,
    });

    expect(symlink).not.toHaveBeenCalled();
  });

  it('logs no regressions when reports are identical', async () => {
    const { existsSync } = await import('node:fs');
    const { readFile } = await import('node:fs/promises');

    vi.mocked(existsSync).mockReturnValue(true);

    const identicalReport = JSON.stringify({
      project: 'test-project',
      scenario: 'basic',
      timestamp: '2026-01-01T00:00:00Z',
      duration_seconds: 5,
      total_frames_analyzed: 2,
      overall_status: 'ok',
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'Frame 1', feature_being_demonstrated: 'startup', bugs_detected: [], visual_quality: 'good', annotation_text: 'Starting' },
      ],
      summary: 'All good.',
      bugs_found: 0,
    });

    // Previous and current reports are identical → no regressions
    vi.mocked(readFile)
      .mockResolvedValueOnce(identicalReport as never)
      .mockResolvedValueOnce(identicalReport as never);

    const logs: string[] = [];
    const result = await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
      logger: { log: (msg: string) => logs.push(msg), warn: () => {} },
    });

    expect(result.regression).toBeUndefined();
    expect(logs.some((l) => l.includes('No regressions'))).toBe(true);
  });

  it('handles error reading previous report gracefully', async () => {
    const { existsSync } = await import('node:fs');
    const { readFile } = await import('node:fs/promises');

    vi.mocked(existsSync).mockReturnValue(true);
    // readFile throws when trying to read previous report
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT: no such file'));

    const result = await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
    });

    // Should not crash — regression is just undefined
    expect(result.success).toBe(true);
    expect(result.regression).toBeUndefined();
  });

  it('exports updateLatestSymlink for external callers', () => {
    expect(typeof updateLatestSymlink).toBe('function');
  });

  it('uses override timestamp when provided', async () => {
    const { mkdir } = await import('node:fs/promises');

    await record({
      config: baseConfig,
      scenario: baseScenario,
      projectDir: '/tmp/project',
      timestamp: '2026-04-11_12-00',
    });

    // mkdir should have been called with a path containing the custom timestamp
    const mkdirCalls = vi.mocked(mkdir).mock.calls;
    const hasTimestamp = mkdirCalls.some(
      (call) => (call[0] as string).includes('2026-04-11_12-00'),
    );
    expect(hasTimestamp).toBe(true);
  });

  it('exports formatTimestamp function', () => {
    expect(typeof formatTimestamp).toBe('function');
    const ts = formatTimestamp(new Date('2026-04-11T14:30:00Z'));
    // Should produce YYYY-MM-DD_HH-MM format (in local time)
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/);
  });
});
