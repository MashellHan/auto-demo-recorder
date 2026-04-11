/**
 * Recording rate limiter — prevents excessive recording runs within a time window.
 *
 * Useful for CI environments and watch mode to avoid overwhelming system
 * resources or API quotas when changes trigger recordings in rapid succession.
 *
 * The limiter uses a sliding window approach: it tracks timestamps of recent
 * recordings and rejects new runs when the window is full.
 */

/** Configuration for the rate limiter. */
export interface RateLimitConfig {
  /** Maximum number of recordings allowed within the window. */
  readonly maxRecordings: number;
  /** Window duration in seconds. */
  readonly windowSeconds: number;
}

/** Result of a rate limit check. */
export interface RateLimitResult {
  /** Whether the recording is allowed. */
  readonly allowed: boolean;
  /** Number of recordings remaining in the current window. */
  readonly remaining: number;
  /** Seconds until the next recording slot opens (0 if allowed). */
  readonly retryAfterSeconds: number;
  /** Total recordings tracked in the current window. */
  readonly currentCount: number;
  /** Window size in seconds. */
  readonly windowSeconds: number;
  /** Maximum recordings per window. */
  readonly maxRecordings: number;
}

/** Snapshot of rate limiter state for serialization/inspection. */
export interface RateLimiterSnapshot {
  /** Timestamps of recordings in the current window. */
  readonly timestamps: readonly number[];
  /** Configuration. */
  readonly config: RateLimitConfig;
}

/**
 * Sliding-window rate limiter for recording sessions.
 *
 * Thread-safe for single-process use (no external state file needed).
 * Create one instance per process and share across recording workflows.
 */
export class RateLimiter {
  private readonly config: RateLimitConfig;
  private timestamps: number[] = [];
  private readonly nowFn: () => number;

  constructor(config: RateLimitConfig, nowFn?: () => number) {
    if (config.maxRecordings < 1) {
      throw new Error('maxRecordings must be at least 1');
    }
    if (config.windowSeconds < 1) {
      throw new Error('windowSeconds must be at least 1');
    }
    this.config = { ...config };
    this.nowFn = nowFn ?? (() => Date.now());
  }

  /**
   * Check whether a new recording is allowed without consuming a slot.
   */
  check(): RateLimitResult {
    this.pruneExpired();
    const now = this.nowFn();
    const allowed = this.timestamps.length < this.config.maxRecordings;
    const remaining = Math.max(0, this.config.maxRecordings - this.timestamps.length);

    let retryAfterSeconds = 0;
    if (!allowed && this.timestamps.length > 0) {
      const oldestInWindow = this.timestamps[0];
      const windowMs = this.config.windowSeconds * 1000;
      const expiresAt = oldestInWindow + windowMs;
      retryAfterSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    }

    return {
      allowed,
      remaining,
      retryAfterSeconds,
      currentCount: this.timestamps.length,
      windowSeconds: this.config.windowSeconds,
      maxRecordings: this.config.maxRecordings,
    };
  }

  /**
   * Attempt to acquire a recording slot.
   * Returns the post-acquisition state; if allowed, the slot is consumed before
   * computing the result so remaining/currentCount reflect the new state.
   */
  acquire(): RateLimitResult {
    const preCheck = this.check();
    if (!preCheck.allowed) {
      return preCheck;
    }
    this.timestamps.push(this.nowFn());
    return this.check();
  }

  /**
   * Reset all tracked timestamps, freeing all slots.
   */
  reset(): void {
    this.timestamps = [];
  }

  /**
   * Get a snapshot of the current state for inspection or serialization.
   */
  snapshot(): RateLimiterSnapshot {
    this.pruneExpired();
    return {
      timestamps: [...this.timestamps],
      config: { ...this.config },
    };
  }

  /**
   * Remove timestamps that have fallen outside the sliding window.
   */
  private pruneExpired(): void {
    const cutoff = this.nowFn() - this.config.windowSeconds * 1000;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }
}

/**
 * Create a pre-configured rate limiter from common presets.
 */
export function createRateLimiter(preset: 'ci' | 'watch' | 'aggressive' | 'relaxed'): RateLimiter {
  const presets: Record<string, RateLimitConfig> = {
    ci: { maxRecordings: 10, windowSeconds: 300 },        // 10 per 5 min
    watch: { maxRecordings: 5, windowSeconds: 60 },        // 5 per minute
    aggressive: { maxRecordings: 2, windowSeconds: 30 },   // 2 per 30s
    relaxed: { maxRecordings: 50, windowSeconds: 3600 },   // 50 per hour
  };

  const config = presets[preset];
  if (!config) {
    throw new Error(`Unknown preset "${preset}". Available: ${Object.keys(presets).join(', ')}`);
  }

  return new RateLimiter(config);
}

/**
 * Create a rate limiter from a config's rate_limit section.
 * Returns null if rate limiting is disabled.
 */
export function createRateLimiterFromConfig(rateLimitConfig: {
  enabled: boolean;
  max_recordings: number;
  window_seconds: number;
  preset?: 'ci' | 'watch' | 'aggressive' | 'relaxed';
}): RateLimiter | null {
  if (!rateLimitConfig.enabled) {
    return null;
  }

  if (rateLimitConfig.preset) {
    return createRateLimiter(rateLimitConfig.preset);
  }

  return new RateLimiter({
    maxRecordings: rateLimitConfig.max_recordings,
    windowSeconds: rateLimitConfig.window_seconds,
  });
}

/**
 * Format a rate limit result for display in CLI output.
 */
export function formatRateLimitResult(result: RateLimitResult): string {
  if (result.allowed) {
    return `Rate limit: ${result.remaining}/${result.maxRecordings} recordings remaining (${result.windowSeconds}s window)`;
  }

  return [
    `Rate limit exceeded: ${result.currentCount}/${result.maxRecordings} recordings in ${result.windowSeconds}s window.`,
    `Retry after ${result.retryAfterSeconds}s.`,
  ].join(' ');
}
