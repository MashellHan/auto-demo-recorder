import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchesGlobs, startWatcher } from '../src/pipeline/watcher.js';
import type { WatchConfig, Config, Scenario } from '../src/config/schema.js';

vi.mock('node:fs', () => {
  const watchers: Array<{ callback: Function; close: ReturnType<typeof vi.fn> }> = [];
  return {
    watch: vi.fn((_path: string, _opts: object, callback: Function) => {
      const handle = { close: vi.fn(), callback };
      watchers.push(handle);
      return handle;
    }),
    existsSync: vi.fn(() => false),
    __watchers: watchers,
  };
});

vi.mock('../src/index.js', () => ({
  record: vi.fn(async () => ({
    success: true,
    videoPath: '/tmp/v.mp4',
    rawVideoPath: '/tmp/raw.mp4',
    reportPath: '/tmp/report.json',
    thumbnailPath: '/tmp/thumb.png',
    summary: { status: 'ok', durationSeconds: 5, framesAnalyzed: 5, bugsFound: 0, featuresDemo: [], description: '' },
  })),
  updateLatestSymlink: vi.fn(async () => {}),
  formatTimestamp: vi.fn(() => '2026-04-11_17-30'),
}));

function makeConfig(overrides?: Partial<WatchConfig>): Config {
  return {
    project: { name: 'test', description: 'test project' },
    recording: { width: 800, height: 600, font_size: 14, theme: 'Catppuccin Mocha', fps: 25, max_duration: 30, format: 'mp4' },
    output: { dir: '.demo-recordings', keep_raw: true, keep_frames: false },
    annotation: { enabled: false, model: 'claude-sonnet-4-6', extract_fps: 1, language: 'en', overlay_position: 'bottom', overlay_font_size: 14 },
    watch: {
      include: ['src/**/*'],
      exclude: ['node_modules/**', 'dist/**', '.demo-recordings/**'],
      debounce_ms: 50,
      ...overrides,
    },
    scenarios: [
      { name: 'basic', description: 'Basic test', setup: [], steps: [{ action: 'type', value: './test', pause: '2s' }] },
    ],
  };
}

const silentLogger = { log: vi.fn(), warn: vi.fn() };

describe('matchesGlobs', () => {
  const watchConfig: WatchConfig = {
    include: ['src/**/*', '*.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    debounce_ms: 500,
  };

  it('matches included files', () => {
    expect(matchesGlobs('src/index.ts', watchConfig)).toBe(true);
    expect(matchesGlobs('src/utils/helper.js', watchConfig)).toBe(true);
  });

  it('rejects non-included files', () => {
    expect(matchesGlobs('README.md', watchConfig)).toBe(false);
    expect(matchesGlobs('data/input.json', watchConfig)).toBe(false);
  });

  it('excludes matching patterns', () => {
    expect(matchesGlobs('node_modules/pkg/index.js', watchConfig)).toBe(false);
    expect(matchesGlobs('dist/bundle.js', watchConfig)).toBe(false);
  });

  it('handles glob edge cases', () => {
    expect(matchesGlobs('src/deeply/nested/file.ts', watchConfig)).toBe(true);
    expect(matchesGlobs('app.ts', watchConfig)).toBe(true);
  });
});

describe('startWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('returns a handle with close method', () => {
    const config = makeConfig();
    const handle = startWatcher({ config, projectDir: '/tmp/project', logger: silentLogger });
    expect(handle).toHaveProperty('close');
    expect(typeof handle.close).toBe('function');
    handle.close();
  });

  it('logs watch configuration on start', () => {
    const config = makeConfig();
    const logger = { log: vi.fn(), warn: vi.fn() };
    const handle = startWatcher({ config, projectDir: '/tmp/project', logger });

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Watching'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Include:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Exclude:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Debounce:'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Scenarios: all'));
    handle.close();
  });

  it('logs specific scenario name when provided', () => {
    const config = makeConfig();
    const scenario: Scenario = { name: 'custom', description: 'Custom test', setup: [], steps: [{ action: 'type', value: './test', pause: '2s' }] };
    const logger = { log: vi.fn(), warn: vi.fn() };
    const handle = startWatcher({ config, projectDir: '/tmp/project', scenario, logger });

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Scenario: custom'));
    handle.close();
  });

  it('triggers recording on matching file change after debounce', async () => {
    const { record } = await import('../src/index.js');
    const fs = await import('node:fs');
    const config = makeConfig();
    const handle = startWatcher({ config, projectDir: '/tmp/project', logger: silentLogger });

    // Simulate file change event
    const watchers = (fs as unknown as { __watchers: Array<{ callback: Function }> }).__watchers;
    const watcher = watchers[watchers.length - 1];
    watcher.callback('change', 'src/index.ts');

    // Before debounce, record should not be called
    expect(record).not.toHaveBeenCalled();

    // After debounce
    await vi.advanceTimersByTimeAsync(100);
    expect(record).toHaveBeenCalledTimes(1);

    handle.close();
  });

  it('debounces rapid changes', async () => {
    const { record } = await import('../src/index.js');
    const fs = await import('node:fs');
    const config = makeConfig();
    const handle = startWatcher({ config, projectDir: '/tmp/project', logger: silentLogger });

    const watchers = (fs as unknown as { __watchers: Array<{ callback: Function }> }).__watchers;
    const watcher = watchers[watchers.length - 1];

    // Rapid changes
    watcher.callback('change', 'src/a.ts');
    await vi.advanceTimersByTimeAsync(20);
    watcher.callback('change', 'src/b.ts');
    await vi.advanceTimersByTimeAsync(20);
    watcher.callback('change', 'src/c.ts');

    // Wait for debounce
    await vi.advanceTimersByTimeAsync(100);

    // Should only trigger once
    expect(record).toHaveBeenCalledTimes(1);

    handle.close();
  });

  it('ignores non-matching file changes', async () => {
    const { record } = await import('../src/index.js');
    const fs = await import('node:fs');
    const config = makeConfig();
    const handle = startWatcher({ config, projectDir: '/tmp/project', logger: silentLogger });

    const watchers = (fs as unknown as { __watchers: Array<{ callback: Function }> }).__watchers;
    const watcher = watchers[watchers.length - 1];

    watcher.callback('change', 'README.md');
    await vi.advanceTimersByTimeAsync(100);

    expect(record).not.toHaveBeenCalled();

    handle.close();
  });

  it('ignores null filename', async () => {
    const { record } = await import('../src/index.js');
    const fs = await import('node:fs');
    const config = makeConfig();
    const handle = startWatcher({ config, projectDir: '/tmp/project', logger: silentLogger });

    const watchers = (fs as unknown as { __watchers: Array<{ callback: Function }> }).__watchers;
    const watcher = watchers[watchers.length - 1];

    watcher.callback('change', null);
    await vi.advanceTimersByTimeAsync(100);

    expect(record).not.toHaveBeenCalled();

    handle.close();
  });

  it('handles record failure gracefully', async () => {
    const { record } = await import('../src/index.js');
    vi.mocked(record).mockRejectedValueOnce(new Error('VHS crashed'));
    const fs = await import('node:fs');
    const config = makeConfig();
    const logger = { log: vi.fn(), warn: vi.fn() };
    const handle = startWatcher({ config, projectDir: '/tmp/project', logger });

    const watchers = (fs as unknown as { __watchers: Array<{ callback: Function }> }).__watchers;
    const watcher = watchers[watchers.length - 1];

    watcher.callback('change', 'src/index.ts');
    await vi.advanceTimersByTimeAsync(100);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('VHS crashed'));

    handle.close();
  });

  it('updates symlink when recording multiple scenarios', async () => {
    const { record, updateLatestSymlink } = await import('../src/index.js');
    const fs = await import('node:fs');
    const config = makeConfig();
    config.scenarios.push({ name: 'advanced', description: 'Advanced test', setup: [], steps: [{ action: 'type', value: './test2', pause: '2s' }] });
    const handle = startWatcher({ config, projectDir: '/tmp/project', logger: silentLogger });

    const watchers = (fs as unknown as { __watchers: Array<{ callback: Function }> }).__watchers;
    const watcher = watchers[watchers.length - 1];

    watcher.callback('change', 'src/index.ts');
    await vi.advanceTimersByTimeAsync(100);

    expect(record).toHaveBeenCalledTimes(2);
    expect(vi.mocked(record).mock.calls[0][0]).toHaveProperty('skipSymlinkUpdate', true);
    expect(updateLatestSymlink).toHaveBeenCalledTimes(1);

    handle.close();
  });
});
