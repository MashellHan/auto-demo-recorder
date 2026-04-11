/** Configuration for retry behavior. */
export interface RetryOptions {
  /** Maximum number of retries (0 = no retries, just the initial attempt). */
  maxRetries?: number;
  /** Base delay in milliseconds between retries (doubles each retry). */
  baseDelayMs?: number;
  /** Callback invoked before each retry with the attempt number and error. */
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 2,
  baseDelayMs: 1000,
};

/**
 * Execute a function with automatic retry on failure using exponential backoff.
 *
 * @param fn - The async function to execute.
 * @param options - Retry configuration.
 * @returns The result of the function.
 * @throws The last error if all retries are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_OPTIONS.baseDelayMs;
  const onRetry = options?.onRetry;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        onRetry?.(attempt + 1, lastError);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
