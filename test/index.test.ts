import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all pipeline modules and external deps
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
    cb(null);
    return { stderr: { on: vi.fn() } };
  }),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    symlink: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
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
});
