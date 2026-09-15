/**
 * 💤 Sleep Utilities
 * Provides sleep and jitter functions for rate limiting and retry logic
 */

/**
 * Sleep for a specified duration
 * @param ms Duration in milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sleep with random jitter
 * Adds randomness to avoid thundering herd problem
 * @param baseMs Base duration in milliseconds
 * @param jitterMs Maximum jitter to add (default: 20% of baseMs)
 */
export async function sleepWithJitter(
  baseMs: number,
  jitterMs?: number
): Promise<void> {
  const jitter = jitterMs ?? baseMs * 0.2;
  const actualDelay = baseMs + Math.random() * jitter;
  return sleep(actualDelay);
}

/**
 * Generate random delay within a range
 * @param minMs Minimum duration
 * @param maxMs Maximum duration
 */
export async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return sleep(delay);
}

/**
 * Exponential backoff calculator
 * @param attempt Current attempt number (0-indexed)
 * @param baseMs Base delay in milliseconds
 * @param maxMs Maximum delay cap
 */
export function calculateBackoff(
  attempt: number,
  baseMs: number = 1000,
  maxMs: number = 30000
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  return Math.min(exponential, maxMs);
}

