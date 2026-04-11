import type { Page } from 'playwright';
import type { BrowserStep } from '../config/schema.js';
import type { Logger } from './annotator.js';

/** Parse a duration string like "500ms" or "2s" into milliseconds. */
export function parsePause(pause: string): number {
  const match = pause.match(/^(\d+(?:\.\d+)?)\s*(ms|s)$/i);
  if (!match) return 500;
  const [, num, unit] = match;
  return unit.toLowerCase() === 's'
    ? Math.round(parseFloat(num) * 1000)
    : Math.round(parseFloat(num));
}

/** Map a key name from config format to Playwright's key format. */
export function mapKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    enter: 'Enter',
    tab: 'Tab',
    escape: 'Escape',
    esc: 'Escape',
    backspace: 'Backspace',
    space: ' ',
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    delete: 'Delete',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',
  };
  return keyMap[key.toLowerCase()] ?? key;
}

/**
 * Execute a single browser step on a Playwright page.
 * Returns after the step completes (including the pause delay).
 */
export async function executeStep(
  page: Page,
  step: BrowserStep,
  logger?: Logger,
): Promise<void> {
  const repeatCount = step.repeat ?? 1;

  for (let i = 0; i < repeatCount; i++) {
    await executeSingleStep(page, step, logger);
    const pauseMs = parsePause(step.pause);
    if (pauseMs > 0) {
      await page.waitForTimeout(pauseMs);
    }
  }
}

async function executeSingleStep(
  page: Page,
  step: BrowserStep,
  logger?: Logger,
): Promise<void> {
  switch (step.action) {
    case 'navigate': {
      logger?.log(`    → navigate: ${step.value}`);
      await page.goto(step.value, { waitUntil: 'domcontentloaded' });
      break;
    }
    case 'click': {
      logger?.log(`    → click: ${step.value}`);
      await page.click(step.value);
      break;
    }
    case 'fill': {
      const text = step.text ?? '';
      logger?.log(`    → fill "${step.value}" with "${text}"`);
      await page.fill(step.value, text);
      break;
    }
    case 'type': {
      logger?.log(`    → type: "${step.value}"`);
      await page.keyboard.type(step.value, { delay: 50 });
      break;
    }
    case 'key': {
      const key = mapKeyName(step.value);
      logger?.log(`    → key: ${key}`);
      await page.keyboard.press(key);
      break;
    }
    case 'sleep': {
      const ms = parsePause(step.value);
      logger?.log(`    → sleep: ${ms}ms`);
      await page.waitForTimeout(ms);
      break;
    }
    case 'scroll': {
      const delta = parseInt(step.value, 10) || 300;
      logger?.log(`    → scroll: ${delta}px`);
      await page.mouse.wheel(0, delta);
      break;
    }
    case 'hover': {
      logger?.log(`    → hover: ${step.value}`);
      await page.hover(step.value);
      break;
    }
    case 'select': {
      const option = step.text ?? step.value;
      logger?.log(`    → select: ${option} in ${step.value}`);
      await page.selectOption(step.value, option);
      break;
    }
    case 'screenshot': {
      logger?.log(`    → screenshot: ${step.value}`);
      await page.screenshot({ path: step.value, fullPage: false });
      break;
    }
    case 'wait': {
      logger?.log(`    → wait for: ${step.value}`);
      await page.waitForSelector(step.value);
      break;
    }
  }
}

/**
 * Execute all browser steps in sequence on a Playwright page.
 * Returns the total execution time in milliseconds.
 */
export async function executeAllSteps(
  page: Page,
  steps: BrowserStep[],
  logger?: Logger,
): Promise<number> {
  const start = Date.now();
  for (const step of steps) {
    await executeStep(page, step, logger);
  }
  return Date.now() - start;
}
