import { describe, it, expect } from 'vitest';
import { pLimit } from '../src/pipeline/concurrency.js';

describe('pLimit concurrency limiter', () => {
  it('limits concurrent executions', async () => {
    let running = 0;
    let maxRunning = 0;

    const limit = pLimit(2);

    const task = async (ms: number) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, ms));
      running--;
      return ms;
    };

    const results = await Promise.all([
      limit(() => task(50)),
      limit(() => task(50)),
      limit(() => task(50)),
      limit(() => task(50)),
    ]);

    expect(maxRunning).toBeLessThanOrEqual(2);
    expect(results).toEqual([50, 50, 50, 50]);
  });

  it('returns results in order', async () => {
    const limit = pLimit(1);
    const results = await Promise.all([
      limit(() => Promise.resolve('a')),
      limit(() => Promise.resolve('b')),
      limit(() => Promise.resolve('c')),
    ]);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('propagates errors', async () => {
    const limit = pLimit(2);
    await expect(
      limit(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
  });

  it('allows concurrency of 1 (sequential)', async () => {
    let running = 0;
    let maxRunning = 0;
    const limit = pLimit(1);

    const task = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
    };

    await Promise.all([limit(task), limit(task), limit(task)]);
    expect(maxRunning).toBe(1);
  });

  it('handles unlimited concurrency with high limit', async () => {
    let running = 0;
    let maxRunning = 0;
    const limit = pLimit(100);

    const task = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
    };

    await Promise.all(Array.from({ length: 5 }, () => limit(task)));
    expect(maxRunning).toBe(5);
  });
});
