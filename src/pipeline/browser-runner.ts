import { chromium, firefox, webkit, type Browser, type BrowserContext } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { BrowserScenario, BrowserConfig, RecordingConfig } from '../config/schema.js';
import type { Logger } from './annotator.js';
import { executeAllSteps } from './browser-step-executor.js';

/** Result from a browser recording session (matches VhsRunResult interface). */
export interface BrowserRunResult {
  /** Path to the recorded video file. */
  videoPath: string;
  /** Total duration in milliseconds. */
  durationMs: number;
}

/** Select the Playwright browser launcher based on config. */
function selectLauncher(browserType: 'chromium' | 'firefox' | 'webkit') {
  switch (browserType) {
    case 'firefox':
      return firefox;
    case 'webkit':
      return webkit;
    default:
      return chromium;
  }
}

/**
 * Record a browser session using Playwright.
 * Navigates to the scenario URL, executes all steps while recording video,
 * and returns the video path and duration.
 */
export async function runBrowser(
  scenario: BrowserScenario,
  recording: RecordingConfig,
  outputPath: string,
  logger?: Logger,
): Promise<BrowserRunResult> {
  const browserConfig = recording.browser;
  const outputDir = dirname(outputPath);
  const videoDir = resolve(outputDir, '.browser-video-tmp');
  await mkdir(videoDir, { recursive: true });

  const launcher = selectLauncher(browserConfig.browser);
  const browser: Browser = await launcher.launch({
    headless: browserConfig.headless,
  });

  logger?.log(`  Launching ${browserConfig.browser} (headless: ${browserConfig.headless})`);

  const contextOptions: Parameters<Browser['newContext']>[0] = {
    viewport: {
      width: browserConfig.viewport_width,
      height: browserConfig.viewport_height,
    },
    deviceScaleFactor: browserConfig.device_scale_factor,
    ...(browserConfig.record_video && {
      recordVideo: {
        dir: videoDir,
        size: {
          width: browserConfig.viewport_width,
          height: browserConfig.viewport_height,
        },
      },
    }),
  };

  const context: BrowserContext = await browser.newContext(contextOptions);
  context.setDefaultTimeout(browserConfig.timeout_ms);

  const page = await context.newPage();
  const start = Date.now();

  try {
    // Navigate to the starting URL
    logger?.log(`  Navigating to ${scenario.url}`);
    await page.goto(scenario.url, { waitUntil: 'domcontentloaded' });

    // Execute all scenario steps
    logger?.log(`  Executing ${scenario.steps.length} steps...`);
    await executeAllSteps(page, scenario.steps, logger);

    const durationMs = Date.now() - start;
    logger?.log(`  ✓ Browser recording complete (${(durationMs / 1000).toFixed(1)}s)`);

    // Close page and context to finalize the video
    await page.close();

    const videoPath = await extractVideoPath(context, outputPath);

    await context.close();
    await browser.close();

    return { videoPath, durationMs };
  } catch (error) {
    await context.close();
    await browser.close();
    throw error;
  }
}

/**
 * Extract the recorded video file path from the browser context and
 * rename/move it to the desired output path.
 */
async function extractVideoPath(
  context: BrowserContext,
  targetPath: string,
): Promise<string> {
  const pages = context.pages();
  if (pages.length === 0) {
    throw new Error('No pages found in browser context');
  }

  const video = pages[0]?.video();
  if (!video) {
    throw new Error('No video recorded — ensure record_video is enabled in browser config');
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await video.saveAs(targetPath);

  return targetPath;
}
