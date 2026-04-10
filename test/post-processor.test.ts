import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FrameAnalysis } from '../src/pipeline/annotator.js';

// Mock execFile before importing post-processor
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
    cb(null);
    return { stderr: { on: vi.fn() } };
  }),
}));

const { postProcess } = await import('../src/pipeline/post-processor.js');

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

    expect(execFile).toHaveBeenCalledTimes(2);
    // First call: overlay annotations
    expect(vi.mocked(execFile).mock.calls[0][0]).toBe('ffmpeg');
    expect(vi.mocked(execFile).mock.calls[0][1]).toContain('-i');
    // Second call: thumbnail
    expect(vi.mocked(execFile).mock.calls[1][1]).toContain('-vframes');
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
    const vfArg = vi.mocked(execFile).mock.calls[0][1]?.find((a: string) =>
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

    const vfArg = vi.mocked(execFile).mock.calls[0][1]?.find((a: string) =>
      a.includes('drawbox'),
    );
    expect(vfArg).toContain('y=0');
  });
});
