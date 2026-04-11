import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAutoDiff } from '../src/pipeline/watcher.js';
import type { Config } from '../src/config/schema.js';

vi.mock('node:fs', () => ({
  watch: vi.fn(() => ({ close: vi.fn() })),
  existsSync: vi.fn(() => false),
}));

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(async () => []),
  readFile: vi.fn(async () => '{}'),
}));

vi.mock('../src/index.js', () => ({
  record: vi.fn(async () => ({})),
  updateLatestSymlink: vi.fn(async () => {}),
}));

vi.mock('../src/analytics/diff.js', () => ({
  diffSessions: vi.fn(async () => ({
    sessionA: 'a',
    sessionB: 'b',
    scenarios: [],
    improved: 0,
    regressed: 0,
    unchanged: 0,
    newScenarios: 0,
    removedScenarios: 0,
  })),
  formatSessionDiff: vi.fn(() => 'Session A → Session B\nNo changes'),
}));

function makeConfig(): Config {
  return {
    project: { name: 'test', description: '' },
    recording: { width: 800, height: 600, font_size: 14, theme: 'Catppuccin Mocha', fps: 25, max_duration: 30, format: 'mp4', backend: 'vhs', browser: { headless: true, browser: 'chromium', viewport_width: 1280, viewport_height: 720, timeout_ms: 30000, device_scale_factor: 1, record_video: true }, frame: { style: 'none' }, parallel: false, max_workers: 3 },
    output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false, record_mode: 'always', player: false, docs: false },
    annotation: { enabled: false, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
    watch: { include: ['src/**/*'], exclude: ['node_modules/**'], debounce_ms: 500 },
    scenarios: [],
    browser_scenarios: [],
  } as Config;
}

describe('runAutoDiff', () => {
  const logger = { log: vi.fn(), warn: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when no previous session exists', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue(['2026-04-11_08-00'] as any);

    const config = makeConfig();
    await runAutoDiff(config, '/tmp/project', '2026-04-11_08-00', logger);

    // Should not log diff
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Auto-diff'));
  });

  it('runs diff when previous session exists', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([
      '2026-04-11_08-00',
      '2026-04-11_09-00',
    ] as any);

    const { diffSessions } = await import('../src/analytics/diff.js');

    const config = makeConfig();
    await runAutoDiff(config, '/tmp/project', '2026-04-11_09-00', logger);

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Auto-diff'));
    expect(diffSessions).toHaveBeenCalledWith(
      expect.any(String),
      '2026-04-11_08-00',
      '2026-04-11_09-00',
    );
  });

  it('warns when regressions are detected', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([
      '2026-04-11_08-00',
      '2026-04-11_09-00',
    ] as any);

    const { diffSessions } = await import('../src/analytics/diff.js');
    vi.mocked(diffSessions).mockResolvedValue({
      sessionA: '2026-04-11_08-00',
      sessionB: '2026-04-11_09-00',
      scenarios: [],
      improved: 0,
      regressed: 2,
      unchanged: 0,
      newScenarios: 0,
      removedScenarios: 0,
    });

    const config = makeConfig();
    await runAutoDiff(config, '/tmp/project', '2026-04-11_09-00', logger);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('2 scenario(s) regressed'));
  });

  it('silently handles errors', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'));

    const config = makeConfig();
    // Should not throw
    await expect(runAutoDiff(config, '/tmp/project', '2026-04-11_09-00', logger)).resolves.toBeUndefined();
  });

  it('filters non-timestamp directories', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([
      'latest',
      'not-a-timestamp',
      '2026-04-11_08-00',
      '2026-04-11_09-00',
    ] as any);

    const { diffSessions } = await import('../src/analytics/diff.js');

    const config = makeConfig();
    await runAutoDiff(config, '/tmp/project', '2026-04-11_09-00', logger);

    expect(diffSessions).toHaveBeenCalledWith(
      expect.any(String),
      '2026-04-11_08-00',
      '2026-04-11_09-00',
    );
  });
});
