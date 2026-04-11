import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FrameAnalysis } from '../src/pipeline/annotator.js';

// Mock execFile before importing post-processor
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, args: string[], _opts: unknown, cb: (err: Error | null, stdout?: string, stderr?: string) => void) => {
    // Simulate drawtext support for -filters check
    if (Array.isArray(args) && args.includes('-filters')) {
      cb(null, 'T. drawtext V->V Draw text', '');
    } else {
      cb(null);
    }
    return { stderr: { on: vi.fn() } };
  }),
}));

const { postProcess, resetDrawtextCache } = await import('../src/pipeline/post-processor.js');

describe('postProcess', () => {
  const frames: FrameAnalysis[] = [
    {
      index: 0,
      timestamp: '0:00',
      status: 'ok',
      description: 'Frame 1',
      feature_being_demonstrated: 'startup',
      bugs_detected: [],
      visual_quality: 'good',
      annotation_text: 'App starting',
    },
    {
      index: 1,
      timestamp: '0:01',
      status: 'ok',
      description: 'Frame 2',
      feature_being_demonstrated: 'startup',
      bugs_detected: [],
      visual_quality: 'good',
      annotation_text: 'App starting',
    },
    {
      index: 2,
      timestamp: '0:02',
      status: 'ok',
      description: 'Frame 3',
      feature_being_demonstrated: 'navigation',
      bugs_detected: [],
      visual_quality: 'good',
      annotation_text: 'Navigating',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    resetDrawtextCache();
  });

  it('calls ffmpeg for annotation overlay and thumbnail', async () => {
    const { execFile } = await import('node:child_process');

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames,
      overlayFontSize: 14,
      overlayPosition: 'bottom',
      extractFps: 1,
    });

    expect(execFile).toHaveBeenCalledTimes(3);
    // First call: check drawtext support
    expect(vi.mocked(execFile).mock.calls[0][1]).toContain('-filters');
    // Second call: overlay annotations
    expect(vi.mocked(execFile).mock.calls[1][0]).toBe('ffmpeg');
    expect(vi.mocked(execFile).mock.calls[1][1]).toContain('-i');
    // Third call: thumbnail
    expect(vi.mocked(execFile).mock.calls[2][1]).toContain('-vframes');
  });

  it('applies correct timing with extractFps=2', async () => {
    const { execFile } = await import('node:child_process');

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames,
      overlayFontSize: 14,
      overlayPosition: 'bottom',
      extractFps: 2,
    });

    // The vf filter should use fractional seconds for fps=2
    const vfArg = vi.mocked(execFile).mock.calls[1][1]?.find((a: string) =>
      a.includes('drawtext'),
    );
    expect(vfArg).toBeDefined();
    // startTime for first group (index 0-1) = 0/2 = 0, end = (1+1)/2 = 1
    expect(vfArg).toContain('between(t');
  });

  it('handles top overlay position', async () => {
    const { execFile } = await import('node:child_process');

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames: [frames[0]],
      overlayFontSize: 14,
      overlayPosition: 'top',
      extractFps: 1,
    });

    const vfArg = vi.mocked(execFile).mock.calls[1][1]?.find((a: string) =>
      a.includes('drawbox'),
    );
    expect(vfArg).toContain('y=0');
  });

  it('includes status dot indicators', async () => {
    const { execFile } = await import('node:child_process');

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames,
      overlayFontSize: 14,
      overlayPosition: 'bottom',
      extractFps: 1,
    });

    const vfArg = vi.mocked(execFile).mock.calls[1][1]?.find((a: string) =>
      a.includes('\u25cf'),
    );
    expect(vfArg).toBeDefined();
    // All frames are 'ok' status, so dot should be green
    expect(vfArg).toContain('fontcolor=green');
  });

  it('uses red dot for error status frames', async () => {
    const { execFile } = await import('node:child_process');
    const errorFrames: FrameAnalysis[] = [
      { ...frames[0], status: 'error', bugs_detected: ['UI glitch'] },
    ];

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames: errorFrames,
      overlayFontSize: 14,
      overlayPosition: 'bottom',
      extractFps: 1,
    });

    const vfArg = vi.mocked(execFile).mock.calls[1][1]?.find((a: string) =>
      a.includes('\u25cf'),
    );
    expect(vfArg).toContain('fontcolor=red');
  });

  it('uses yellow dot for warning status frames', async () => {
    const { execFile } = await import('node:child_process');
    const warningFrames: FrameAnalysis[] = [
      { ...frames[0], status: 'warning' },
    ];

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames: warningFrames,
      overlayFontSize: 14,
      overlayPosition: 'bottom',
      extractFps: 1,
    });

    const vfArg = vi.mocked(execFile).mock.calls[1][1]?.find((a: string) =>
      a.includes('\u25cf'),
    );
    expect(vfArg).toContain('fontcolor=yellow');
  });

  it('adds red border for bug frames', async () => {
    const { execFile } = await import('node:child_process');
    const bugFrames: FrameAnalysis[] = [
      { ...frames[0], status: 'error', bugs_detected: ['layout overflow'] },
      frames[1],
    ];

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames: bugFrames,
      overlayFontSize: 14,
      overlayPosition: 'bottom',
      extractFps: 1,
    });

    const vfArg = vi.mocked(execFile).mock.calls[1][1]?.find((a: string) =>
      a.includes('color=red@0.5'),
    );
    expect(vfArg).toBeDefined();
    expect(vfArg).toContain('t=4');
  });

  it('does not add border for ok frames with no bugs', async () => {
    const { execFile } = await import('node:child_process');

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames,
      overlayFontSize: 14,
      overlayPosition: 'bottom',
      extractFps: 1,
    });

    const vfArg = vi.mocked(execFile).mock.calls[1][1]?.find((a: string) =>
      a.includes('color=red@0.5'),
    );
    expect(vfArg).toBeUndefined();
  });

  it('includes fade transitions in drawtext', async () => {
    const { execFile } = await import('node:child_process');

    await postProcess({
      inputVideo: '/tmp/raw.mp4',
      outputVideo: '/tmp/annotated.mp4',
      thumbnailPath: '/tmp/thumb.png',
      frames: [frames[0]],
      overlayFontSize: 14,
      overlayPosition: 'bottom',
      extractFps: 1,
    });

    const vfArg = vi.mocked(execFile).mock.calls[1][1]?.find((a: string) =>
      a.includes('alpha='),
    );
    expect(vfArg).toBeDefined();
    expect(vfArg).toContain('0.3');
  });
});
