import { describe, it, expect, vi } from 'vitest';
import {
  RateLimiter,
  createRateLimiter,
  formatRateLimitResult,
} from '../src/pipeline/rate-limiter.js';

describe('RateLimiter', () => {
  it('allows recordings within the limit', () => {
    const limiter = new RateLimiter({ maxRecordings: 3, windowSeconds: 60 });
    const r1 = limiter.acquire();
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r1.currentCount).toBe(1);
  });

  it('rejects recordings when limit is reached', () => {
    const limiter = new RateLimiter({ maxRecordings: 2, windowSeconds: 60 });
    limiter.acquire();
    limiter.acquire();
    const r3 = limiter.acquire();
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.currentCount).toBe(2);
    expect(r3.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('check() does not consume a slot', () => {
    const limiter = new RateLimiter({ maxRecordings: 1, windowSeconds: 60 });
    const c1 = limiter.check();
    expect(c1.allowed).toBe(true);
    const c2 = limiter.check();
    expect(c2.allowed).toBe(true);
    expect(c2.currentCount).toBe(0);
  });

  it('slots free up after the window expires', () => {
    let now = 1000000;
    const limiter = new RateLimiter(
      { maxRecordings: 1, windowSeconds: 10 },
      () => now,
    );
    limiter.acquire();
    expect(limiter.check().allowed).toBe(false);

    // Advance past the window
    now += 11000;
    expect(limiter.check().allowed).toBe(true);
    const r = limiter.acquire();
    // Post-acquire: 1/1 slot used, so allowed=false but currentCount=1
    expect(r.currentCount).toBe(1);
    expect(r.remaining).toBe(0);
  });

  it('reset() clears all tracked timestamps', () => {
    const limiter = new RateLimiter({ maxRecordings: 1, windowSeconds: 60 });
    limiter.acquire();
    expect(limiter.check().allowed).toBe(false);
    limiter.reset();
    expect(limiter.check().allowed).toBe(true);
  });

  it('snapshot() returns current state', () => {
    const limiter = new RateLimiter({ maxRecordings: 5, windowSeconds: 120 });
    limiter.acquire();
    limiter.acquire();
    const snap = limiter.snapshot();
    expect(snap.timestamps).toHaveLength(2);
    expect(snap.config.maxRecordings).toBe(5);
    expect(snap.config.windowSeconds).toBe(120);
  });

  it('throws for invalid config', () => {
    expect(() => new RateLimiter({ maxRecordings: 0, windowSeconds: 60 }))
      .toThrow('maxRecordings must be at least 1');
    expect(() => new RateLimiter({ maxRecordings: 1, windowSeconds: 0 }))
      .toThrow('windowSeconds must be at least 1');
  });

  it('retryAfterSeconds calculates correctly', () => {
    let now = 1000000;
    const limiter = new RateLimiter(
      { maxRecordings: 1, windowSeconds: 30 },
      () => now,
    );
    limiter.acquire();
    now += 10000; // 10s later
    const result = limiter.check();
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(20); // 30 - 10 = 20
  });

  it('handles sliding window with multiple timestamps', () => {
    let now = 1000000;
    const limiter = new RateLimiter(
      { maxRecordings: 3, windowSeconds: 10 },
      () => now,
    );
    limiter.acquire(); // t=0
    now += 3000;
    limiter.acquire(); // t=3
    now += 3000;
    limiter.acquire(); // t=6
    expect(limiter.check().allowed).toBe(false);

    // First slot expires at t=10
    now += 5000; // t=11
    expect(limiter.check().allowed).toBe(true);
    expect(limiter.check().currentCount).toBe(2);
  });
});

describe('createRateLimiter', () => {
  it('creates a limiter from CI preset', () => {
    const limiter = createRateLimiter('ci');
    const snap = limiter.snapshot();
    expect(snap.config.maxRecordings).toBe(10);
    expect(snap.config.windowSeconds).toBe(300);
  });

  it('creates a limiter from watch preset', () => {
    const limiter = createRateLimiter('watch');
    const snap = limiter.snapshot();
    expect(snap.config.maxRecordings).toBe(5);
    expect(snap.config.windowSeconds).toBe(60);
  });

  it('creates a limiter from aggressive preset', () => {
    const limiter = createRateLimiter('aggressive');
    const snap = limiter.snapshot();
    expect(snap.config.maxRecordings).toBe(2);
  });

  it('creates a limiter from relaxed preset', () => {
    const limiter = createRateLimiter('relaxed');
    const snap = limiter.snapshot();
    expect(snap.config.maxRecordings).toBe(50);
  });

  it('throws for unknown preset', () => {
    expect(() => createRateLimiter('nope' as any)).toThrow('Unknown preset');
  });
});

describe('formatRateLimitResult', () => {
  it('formats an allowed result', () => {
    const text = formatRateLimitResult({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
      currentCount: 1,
      windowSeconds: 60,
      maxRecordings: 5,
    });
    expect(text).toContain('4/5 recordings remaining');
    expect(text).toContain('60s window');
  });

  it('formats a rejected result', () => {
    const text = formatRateLimitResult({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 15,
      currentCount: 5,
      windowSeconds: 60,
      maxRecordings: 5,
    });
    expect(text).toContain('Rate limit exceeded');
    expect(text).toContain('5/5 recordings');
    expect(text).toContain('Retry after 15s');
  });
});
