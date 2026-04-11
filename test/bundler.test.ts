import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBundleManifest, writeBundleManifest, formatManifestSummary } from '../src/pipeline/bundler.js';
import type { BundleManifest, BundleOptions } from '../src/pipeline/bundler.js';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('createBundleManifest', () => {
  it('throws when recording directory does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(
      createBundleManifest({ recordingDir: '/missing', outputPath: '/out' }),
    ).rejects.toThrow('Recording directory not found: /missing');
  });

  it('inventories files in recording directory', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue([
      { name: 'raw.mp4', isDirectory: () => false },
      { name: 'report.json', isDirectory: () => false },
      { name: 'player.html', isDirectory: () => false },
      { name: 'DEMO.md', isDirectory: () => false },
    ] as never);
    vi.mocked(stat).mockResolvedValue({ size: 1024 } as never);
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ project: 'myproj', scenario: 'demo', timestamp: '2026-01-01T00:00:00Z' }),
    );

    const manifest = await createBundleManifest({ recordingDir: '/rec', outputPath: '/out' });

    expect(manifest.project).toBe('myproj');
    expect(manifest.scenario).toBe('demo');
    expect(manifest.timestamp).toBe('2026-01-01T00:00:00Z');
    expect(manifest.files).toHaveLength(4);
    expect(manifest.totalSize).toBe(4096);
  });

  it('classifies files by type correctly', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue([
      { name: 'raw.mp4', isDirectory: () => false },
      { name: 'raw.webm', isDirectory: () => false },
      { name: 'raw.gif', isDirectory: () => false },
      { name: 'report.json', isDirectory: () => false },
      { name: 'player.html', isDirectory: () => false },
      { name: 'DEMO.md', isDirectory: () => false },
      { name: 'recording.svg', isDirectory: () => false },
      { name: 'thumbnail.png', isDirectory: () => false },
      { name: 'screenshot.png', isDirectory: () => false },
      { name: 'config.yaml', isDirectory: () => false },
    ] as never);
    vi.mocked(stat).mockResolvedValue({ size: 100 } as never);
    // No report.json content needed — existsSync for report returns true but readFile can fail
    vi.mocked(readFile).mockRejectedValue(new Error('parse'));

    const manifest = await createBundleManifest({ recordingDir: '/rec', outputPath: '/out' });

    const types = manifest.files.map((f) => ({ name: f.name, type: f.type }));
    expect(types).toContainEqual({ name: 'raw.mp4', type: 'video' });
    expect(types).toContainEqual({ name: 'raw.webm', type: 'video' });
    expect(types).toContainEqual({ name: 'raw.gif', type: 'video' });
    expect(types).toContainEqual({ name: 'report.json', type: 'report' });
    expect(types).toContainEqual({ name: 'player.html', type: 'player' });
    expect(types).toContainEqual({ name: 'DEMO.md', type: 'docs' });
    expect(types).toContainEqual({ name: 'recording.svg', type: 'svg' });
    expect(types).toContainEqual({ name: 'thumbnail.png', type: 'thumbnail' });
    expect(types).toContainEqual({ name: 'screenshot.png', type: 'frame' });
    expect(types).toContainEqual({ name: 'config.yaml', type: 'other' });
  });

  it('excludes raw video when includeRaw is false', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue([
      { name: 'raw.mp4', isDirectory: () => false },
      { name: 'report.json', isDirectory: () => false },
    ] as never);
    vi.mocked(stat).mockResolvedValue({ size: 500 } as never);
    vi.mocked(readFile).mockResolvedValue('{}');

    const manifest = await createBundleManifest({
      recordingDir: '/rec',
      outputPath: '/out',
      includeRaw: false,
    });

    expect(manifest.files.map((f) => f.name)).not.toContain('raw.mp4');
    expect(manifest.files).toHaveLength(1);
  });

  it('includes frames directory when includeFrames is true', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    // Main readdir returns frames directory + a file
    vi.mocked(readdir)
      .mockResolvedValueOnce([
        { name: 'frames', isDirectory: () => true },
        { name: 'report.json', isDirectory: () => false },
      ] as never)
      .mockResolvedValueOnce(['frame-001.png', 'frame-002.png'] as never);
    vi.mocked(stat).mockResolvedValue({ size: 200 } as never);
    vi.mocked(readFile).mockResolvedValue('{}');

    const manifest = await createBundleManifest({
      recordingDir: '/rec',
      outputPath: '/out',
      includeFrames: true,
    });

    const frameFiles = manifest.files.filter((f) => f.type === 'frame');
    expect(frameFiles).toHaveLength(2);
    expect(frameFiles[0].name).toBe('frames/frame-001.png');
    expect(frameFiles[1].name).toBe('frames/frame-002.png');
  });

  it('skips frames directory when includeFrames is false (default)', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue([
      { name: 'frames', isDirectory: () => true },
      { name: 'report.json', isDirectory: () => false },
    ] as never);
    vi.mocked(stat).mockResolvedValue({ size: 200 } as never);
    vi.mocked(readFile).mockResolvedValue('{}');

    const manifest = await createBundleManifest({ recordingDir: '/rec', outputPath: '/out' });

    expect(manifest.files.filter((f) => f.type === 'frame')).toHaveLength(0);
  });

  it('uses defaults when report.json is missing', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (String(p).endsWith('report.json')) return false;
      return true;
    });
    vi.mocked(readdir).mockResolvedValue([
      { name: 'raw.mp4', isDirectory: () => false },
    ] as never);
    vi.mocked(stat).mockResolvedValue({ size: 1000 } as never);

    const manifest = await createBundleManifest({ recordingDir: '/rec', outputPath: '/out' });

    expect(manifest.project).toBe('unknown');
    expect(manifest.scenario).toBe('unknown');
    expect(manifest.timestamp).toBe('');
  });
});

describe('writeBundleManifest', () => {
  it('writes manifest as JSON', async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined as never);

    const manifest: BundleManifest = {
      project: 'test',
      scenario: 'demo',
      timestamp: '2026-01-01',
      files: [{ name: 'raw.mp4', size: 1024, type: 'video' }],
      totalSize: 1024,
    };

    await writeBundleManifest(manifest, '/out/manifest.json');

    expect(writeFile).toHaveBeenCalledWith(
      '/out/manifest.json',
      expect.stringContaining('"project": "test"'),
      'utf-8',
    );
  });
});

describe('formatManifestSummary', () => {
  it('formats a human-readable summary', () => {
    const manifest: BundleManifest = {
      project: 'MyApp',
      scenario: 'login-flow',
      timestamp: '2026-04-11T12:00:00Z',
      files: [
        { name: 'raw.mp4', size: 2_500_000, type: 'video' },
        { name: 'report.json', size: 4096, type: 'report' },
        { name: 'player.html', size: 8192, type: 'player' },
      ],
      totalSize: 2_512_288,
    };

    const summary = formatManifestSummary(manifest);

    expect(summary).toContain('Bundle: MyApp — login-flow');
    expect(summary).toContain('Recorded: 2026-04-11T12:00:00Z');
    expect(summary).toContain('Files: 3');
    expect(summary).toContain('2.4MB');
    expect(summary).toContain('raw.mp4');
    expect(summary).toContain('report.json');
    expect(summary).toContain('player.html');
  });

  it('omits timestamp when empty', () => {
    const manifest: BundleManifest = {
      project: 'Test',
      scenario: 'demo',
      timestamp: '',
      files: [],
      totalSize: 0,
    };

    const summary = formatManifestSummary(manifest);

    expect(summary).not.toContain('Recorded:');
  });

  it('groups files by type with counts and sizes', () => {
    const manifest: BundleManifest = {
      project: 'Test',
      scenario: 'demo',
      timestamp: '',
      files: [
        { name: 'raw.mp4', size: 1_000_000, type: 'video' },
        { name: 'annotated.mp4', size: 1_500_000, type: 'video' },
        { name: 'report.json', size: 500, type: 'report' },
      ],
      totalSize: 2_500_500,
    };

    const summary = formatManifestSummary(manifest);

    expect(summary).toContain('video (2 files');
    expect(summary).toContain('report (1 file');
  });

  it('formats bytes correctly', () => {
    const manifest: BundleManifest = {
      project: 'Test',
      scenario: 'demo',
      timestamp: '',
      files: [{ name: 'tiny.txt', size: 512, type: 'other' }],
      totalSize: 512,
    };

    const summary = formatManifestSummary(manifest);

    expect(summary).toContain('512B');
  });

  it('formats kilobytes correctly', () => {
    const manifest: BundleManifest = {
      project: 'Test',
      scenario: 'demo',
      timestamp: '',
      files: [{ name: 'medium.json', size: 5120, type: 'report' }],
      totalSize: 5120,
    };

    const summary = formatManifestSummary(manifest);

    expect(summary).toContain('5.0KB');
  });
});
