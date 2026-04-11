import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserScenario, RecordingConfig } from '../src/config/schema.js';

// Mock playwright
const mockVideo = {
  saveAs: vi.fn().mockResolvedValue(undefined),
};

const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  video: vi.fn().mockReturnValue(mockVideo),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  click: vi.fn().mockResolvedValue(undefined),
  keyboard: {
    type: vi.fn().mockResolvedValue(undefined),
    press: vi.fn().mockResolvedValue(undefined),
  },
  mouse: {
    wheel: vi.fn().mockResolvedValue(undefined),
  },
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  setDefaultTimeout: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  pages: vi.fn().mockReturnValue([mockPage]),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('playwright', () => ({
  chromium: { launch: vi.fn().mockResolvedValue(mockBrowser) },
  firefox: { launch: vi.fn().mockResolvedValue(mockBrowser) },
  webkit: { launch: vi.fn().mockResolvedValue(mockBrowser) },
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as any;
  return {
    ...orig,
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

const { runBrowser } = await import('../src/pipeline/browser-runner.js');
const playwright = await import('playwright');

describe('runBrowser', () => {
  const defaultRecording: RecordingConfig = {
    width: 1200,
    height: 800,
    font_size: 16,
    theme: 'Catppuccin Mocha',
    fps: 25,
    max_duration: 60,
    format: 'mp4',
    backend: 'browser',
    browser: {
      headless: true,
      browser: 'chromium',
      viewport_width: 1280,
      viewport_height: 720,
      timeout_ms: 30_000,
      device_scale_factor: 1,
      record_video: true,
    },
  };

  const defaultScenario: BrowserScenario = {
    name: 'test-scenario',
    description: 'A test browser scenario',
    url: 'http://localhost:3000',
    setup: [],
    steps: [
      { action: 'click', value: '#btn', pause: '0ms' },
      { action: 'sleep', value: '1s', pause: '0ms' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock chain
    mockContext.newPage.mockResolvedValue(mockPage);
    mockContext.pages.mockReturnValue([mockPage]);
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockPage.video.mockReturnValue(mockVideo);
  });

  it('records a browser session and returns result', async () => {
    const result = await runBrowser(
      defaultScenario,
      defaultRecording,
      '/tmp/output/raw.webm',
    );

    expect(result.videoPath).toBe('/tmp/output/raw.webm');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('navigates to scenario URL', async () => {
    await runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm');
    expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  });

  it('executes all scenario steps', async () => {
    await runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm');
    expect(mockPage.click).toHaveBeenCalledWith('#btn');
    expect(mockPage.waitForTimeout).toHaveBeenCalled();
  });

  it('closes page and browser after recording', async () => {
    await runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm');
    expect(mockPage.close).toHaveBeenCalled();
    expect(mockContext.close).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('saves video to output path', async () => {
    await runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm');
    expect(mockVideo.saveAs).toHaveBeenCalledWith('/tmp/output/raw.webm');
  });

  it('sets viewport from config', async () => {
    await runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm');
    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      }),
    );
  });

  it('enables video recording when configured', async () => {
    await runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm');
    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        recordVideo: expect.objectContaining({
          size: { width: 1280, height: 720 },
        }),
      }),
    );
  });

  it('cleans up on error', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

    await expect(
      runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm'),
    ).rejects.toThrow('Navigation failed');

    expect(mockContext.close).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('throws when no video is recorded', async () => {
    mockPage.video.mockReturnValueOnce(null);

    await expect(
      runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm'),
    ).rejects.toThrow('No video recorded');
  });

  it('throws when no pages exist', async () => {
    mockContext.pages.mockReturnValueOnce([]);

    await expect(
      runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm'),
    ).rejects.toThrow('No pages found');
  });

  it('logs progress when logger is provided', async () => {
    const logger = { log: vi.fn(), warn: vi.fn() };
    await runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm', logger);

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Launching chromium'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Navigating to'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Executing'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Browser recording complete'));
  });

  it('sets default timeout from config', async () => {
    await runBrowser(defaultScenario, defaultRecording, '/tmp/output/raw.webm');
    expect(mockContext.setDefaultTimeout).toHaveBeenCalledWith(30_000);
  });
});
