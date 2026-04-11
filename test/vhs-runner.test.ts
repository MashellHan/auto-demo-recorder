import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
    cb(null);
    return {
      stderr: { on: vi.fn() },
    };
  }),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

const { runVhs } = await import('../src/pipeline/vhs-runner.js');

describe('runVhs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes tape file and calls vhs', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { execFile } = await import('node:child_process');

    const tapeContent = 'Output "/tmp/test.mp4"\nSet Width 1200\nType "hello"\nEnter\n';
    const result = await runVhs('/tmp/test.tape', tapeContent);

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith('/tmp/test.tape', tapeContent, 'utf-8');
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(vi.mocked(execFile).mock.calls[0][0]).toBe('vhs');
    expect(vi.mocked(execFile).mock.calls[0][1]).toEqual(['/tmp/test.tape']);
    expect(result.videoPath).toBe('/tmp/test.mp4');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws if Output directive is missing', async () => {
    const tapeContent = 'Set Width 1200\nType "hello"\n';
    await expect(runVhs('/tmp/test.tape', tapeContent)).rejects.toThrow(
      'Could not find Output directive',
    );
  });

  it('throws when VHS process fails', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementationOnce(
      (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('vhs binary not found'));
        return { stderr: { on: vi.fn() } } as never;
      },
    );

    const tapeContent = 'Output "/tmp/test.mp4"\nType "hello"\n';
    await expect(runVhs('/tmp/test.tape', tapeContent)).rejects.toThrow('VHS failed: vhs binary not found');
  });

  it('forwards stderr output to console.error', async () => {
    const { execFile } = await import('node:child_process');
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(execFile).mockImplementationOnce(
      (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null) => void) => {
        const stderrHandlers: Array<(data: Buffer) => void> = [];
        const mockProc = {
          stderr: {
            on: vi.fn((event: string, handler: (data: Buffer) => void) => {
              if (event === 'data') {
                stderrHandlers.push(handler);
              }
            }),
          },
        };
        // Trigger stderr data before resolving
        setTimeout(() => {
          for (const h of stderrHandlers) {
            h(Buffer.from('Rendering frame 1/10'));
          }
          cb(null);
        }, 0);
        return mockProc as never;
      },
    );

    const tapeContent = 'Output "/tmp/test.mp4"\nType "hello"\n';
    await runVhs('/tmp/test.tape', tapeContent);

    expect(stderrSpy).toHaveBeenCalledWith('  [vhs] Rendering frame 1/10');
    stderrSpy.mockRestore();
  });
});
