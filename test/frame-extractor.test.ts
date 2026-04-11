import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    readdir: vi.fn().mockResolvedValue(['frame-001.png', 'frame-002.png', 'frame-003.png']),
  };
});

const { extractFrames } = await import('../src/pipeline/frame-extractor.js');

describe('extractFrames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates output directory and calls ffmpeg', async () => {
    const { mkdir } = await import('node:fs/promises');
    const { execFile } = await import('node:child_process');

    const result = await extractFrames('/tmp/raw.mp4', '/tmp/frames', 1);

    expect(mkdir).toHaveBeenCalledWith('/tmp/frames', { recursive: true });
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(vi.mocked(execFile).mock.calls[0][0]).toBe('ffmpeg');
    expect(result.framesDir).toBe('/tmp/frames');
    expect(result.frameCount).toBe(3);
  });

  it('uses custom fps', async () => {
    const { execFile } = await import('node:child_process');

    await extractFrames('/tmp/raw.mp4', '/tmp/frames', 2);

    const args = vi.mocked(execFile).mock.calls[0][1];
    expect(args).toContain('fps=2');
  });

  it('defaults fps to 1', async () => {
    const { execFile } = await import('node:child_process');

    await extractFrames('/tmp/raw.mp4', '/tmp/frames');

    const args = vi.mocked(execFile).mock.calls[0][1];
    expect(args).toContain('fps=1');
  });

  it('throws when ffmpeg fails', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementationOnce(
      (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('ffmpeg not found'));
        return { stderr: { on: vi.fn() } } as never;
      },
    );

    await expect(extractFrames('/tmp/raw.mp4', '/tmp/frames', 1)).rejects.toThrow(
      'ffmpeg frame extraction failed: ffmpeg not found',
    );
  });
});
