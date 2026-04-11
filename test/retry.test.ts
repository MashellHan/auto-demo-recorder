import { describe, it, expect, vi } from 'vitest';
import { withRetry, type RetryOptions } from '../src/pipeline/retry.js';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn(async () => 42);
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 }),
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('uses exponential backoff', async () => {
    const delays: number[] = [];
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const originalSetTimeout = globalThis.setTimeout;
    const mockSetTimeout = vi.fn((cb: Function, ms: number) => {
      delays.push(ms);
      return originalSetTimeout(cb, 0) as any; // execute immediately for test speed
    });
    vi.stubGlobal('setTimeout', mockSetTimeout);

    await withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });

    vi.unstubAllGlobals();

    // First retry: 100ms, second: 200ms (exponential)
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);
  });

  it('calls onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('ok');

    await withRetry(fn, { maxRetries: 2, baseDelayMs: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('handles maxRetries of 0 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 10 }),
    ).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses default options when not specified', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
  });
});
