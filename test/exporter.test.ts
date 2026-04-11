import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createArchive, listSessionArtifacts } from '../src/pipeline/exporter.js';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ isDirectory: () => false, isFile: () => true })),
  access: vi.fn(async () => {}),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn((...args: any[]) => {
    // promisify calls execFile and appends a callback as the last argument
    const cb = args[args.length - 1];
    if (typeof cb === 'function') {
      cb(null, '', '');
    }
    return { on: vi.fn() };
  }),
}));

describe('listSessionArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists files in a session directory', async () => {
    const { readdir, stat } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([
      'basic-navigation',
      'session-report.json',
    ] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any)
      .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any);

    const result = await listSessionArtifacts('/output/2026-04-11_08-00');
    expect(result.directories).toContain('basic-navigation');
    expect(result.files).toContain('session-report.json');
  });

  it('returns empty arrays for empty directory', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([] as any);

    const result = await listSessionArtifacts('/output/2026-04-11_08-00');
    expect(result.directories).toEqual([]);
    expect(result.files).toEqual([]);
  });
});

describe('createArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a tar.gz archive', async () => {
    const { execFile } = await import('node:child_process');

    const result = await createArchive('/output/2026-04-11_08-00', '/tmp/export', 'tar');

    expect(result.format).toBe('tar');
    expect(result.outputPath).toContain('.tar.gz');
    expect(execFile).toHaveBeenCalled();
  });

  it('creates a zip archive', async () => {
    const { execFile } = await import('node:child_process');

    const result = await createArchive('/output/2026-04-11_08-00', '/tmp/export', 'zip');

    expect(result.format).toBe('zip');
    expect(result.outputPath).toContain('.zip');
    expect(execFile).toHaveBeenCalled();
  });

  it('defaults to tar format', async () => {
    const result = await createArchive('/output/2026-04-11_08-00', '/tmp/export');

    expect(result.format).toBe('tar');
  });

  it('derives archive name from session directory', async () => {
    const result = await createArchive('/output/2026-04-11_08-00', '/tmp/export', 'tar');

    expect(result.outputPath).toContain('2026-04-11_08-00');
  });
});
