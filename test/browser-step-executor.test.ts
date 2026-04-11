import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePause, mapKeyName, executeStep, executeAllSteps } from '../src/pipeline/browser-step-executor.js';
import type { BrowserStep } from '../src/config/schema.js';

describe('parsePause', () => {
  it('parses milliseconds', () => {
    expect(parsePause('500ms')).toBe(500);
    expect(parsePause('100ms')).toBe(100);
    expect(parsePause('0ms')).toBe(0);
  });

  it('parses seconds', () => {
    expect(parsePause('2s')).toBe(2000);
    expect(parsePause('1.5s')).toBe(1500);
    expect(parsePause('0.5s')).toBe(500);
  });

  it('returns default for invalid format', () => {
    expect(parsePause('invalid')).toBe(500);
    expect(parsePause('')).toBe(500);
    expect(parsePause('abc')).toBe(500);
  });

  it('is case insensitive', () => {
    expect(parsePause('500MS')).toBe(500);
    expect(parsePause('2S')).toBe(2000);
  });
});

describe('mapKeyName', () => {
  it('maps common key names', () => {
    expect(mapKeyName('enter')).toBe('Enter');
    expect(mapKeyName('tab')).toBe('Tab');
    expect(mapKeyName('escape')).toBe('Escape');
    expect(mapKeyName('esc')).toBe('Escape');
    expect(mapKeyName('backspace')).toBe('Backspace');
    expect(mapKeyName('space')).toBe(' ');
  });

  it('maps arrow keys', () => {
    expect(mapKeyName('up')).toBe('ArrowUp');
    expect(mapKeyName('down')).toBe('ArrowDown');
    expect(mapKeyName('left')).toBe('ArrowLeft');
    expect(mapKeyName('right')).toBe('ArrowRight');
  });

  it('maps additional keys', () => {
    expect(mapKeyName('delete')).toBe('Delete');
    expect(mapKeyName('home')).toBe('Home');
    expect(mapKeyName('end')).toBe('End');
    expect(mapKeyName('pageup')).toBe('PageUp');
    expect(mapKeyName('pagedown')).toBe('PageDown');
  });

  it('is case insensitive', () => {
    expect(mapKeyName('Enter')).toBe('Enter');
    expect(mapKeyName('ENTER')).toBe('Enter');
    expect(mapKeyName('Tab')).toBe('Tab');
  });

  it('passes through unmapped keys', () => {
    expect(mapKeyName('a')).toBe('a');
    expect(mapKeyName('F1')).toBe('F1');
    expect(mapKeyName('Control')).toBe('Control');
  });
});

describe('executeStep', () => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    keyboard: {
      type: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
    },
    mouse: {
      wheel: vi.fn().mockResolvedValue(undefined),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes navigate step', async () => {
    const step: BrowserStep = { action: 'navigate', value: 'http://example.com', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.goto).toHaveBeenCalledWith('http://example.com', { waitUntil: 'domcontentloaded' });
  });

  it('executes click step', async () => {
    const step: BrowserStep = { action: 'click', value: '#btn', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.click).toHaveBeenCalledWith('#btn');
  });

  it('executes fill step with text', async () => {
    const step: BrowserStep = { action: 'fill', value: '#input', text: 'hello', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.fill).toHaveBeenCalledWith('#input', 'hello');
  });

  it('executes fill step without text defaults to empty string', async () => {
    const step: BrowserStep = { action: 'fill', value: '#input', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.fill).toHaveBeenCalledWith('#input', '');
  });

  it('executes type step', async () => {
    const step: BrowserStep = { action: 'type', value: 'hello world', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.keyboard.type).toHaveBeenCalledWith('hello world', { delay: 50 });
  });

  it('executes key step with mapping', async () => {
    const step: BrowserStep = { action: 'key', value: 'enter', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
  });

  it('executes sleep step', async () => {
    const step: BrowserStep = { action: 'sleep', value: '2s', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
  });

  it('executes scroll step', async () => {
    const step: BrowserStep = { action: 'scroll', value: '300', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 300);
  });

  it('executes scroll step with default value for NaN', async () => {
    const step: BrowserStep = { action: 'scroll', value: 'invalid', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.mouse.wheel).toHaveBeenCalledWith(0, 300);
  });

  it('executes hover step', async () => {
    const step: BrowserStep = { action: 'hover', value: '.menu', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.hover).toHaveBeenCalledWith('.menu');
  });

  it('executes select step with text', async () => {
    const step: BrowserStep = { action: 'select', value: '#dropdown', text: 'opt1', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.selectOption).toHaveBeenCalledWith('#dropdown', 'opt1');
  });

  it('executes select step without text uses value', async () => {
    const step: BrowserStep = { action: 'select', value: '#dropdown', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.selectOption).toHaveBeenCalledWith('#dropdown', '#dropdown');
  });

  it('executes screenshot step', async () => {
    const step: BrowserStep = { action: 'screenshot', value: 'test.png', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.screenshot).toHaveBeenCalledWith({ path: 'test.png', fullPage: false });
  });

  it('executes wait step', async () => {
    const step: BrowserStep = { action: 'wait', value: '.loaded', pause: '0ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loaded');
  });

  it('waits for pause after step', async () => {
    const step: BrowserStep = { action: 'click', value: '#btn', pause: '500ms' };
    await executeStep(mockPage as any, step);
    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
  });

  it('repeats step when repeat is set', async () => {
    const step: BrowserStep = { action: 'click', value: '#btn', pause: '0ms', repeat: 3 };
    await executeStep(mockPage as any, step);
    expect(mockPage.click).toHaveBeenCalledTimes(3);
  });

  it('logs steps when logger is provided', async () => {
    const logger = { log: vi.fn(), warn: vi.fn() };
    const step: BrowserStep = { action: 'click', value: '#btn', pause: '0ms' };
    await executeStep(mockPage as any, step, logger);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('click'));
  });
});

describe('executeAllSteps', () => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes all steps in sequence', async () => {
    const steps: BrowserStep[] = [
      { action: 'click', value: '#a', pause: '0ms' },
      { action: 'click', value: '#b', pause: '0ms' },
      { action: 'key', value: 'Enter', pause: '0ms' },
    ];

    const duration = await executeAllSteps(mockPage as any, steps);

    expect(mockPage.click).toHaveBeenCalledTimes(2);
    expect(mockPage.keyboard.press).toHaveBeenCalledTimes(1);
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('returns total execution duration', async () => {
    const steps: BrowserStep[] = [
      { action: 'click', value: '#a', pause: '0ms' },
    ];

    const duration = await executeAllSteps(mockPage as any, steps);
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('handles empty steps array', async () => {
    const duration = await executeAllSteps(mockPage as any, []);
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});
