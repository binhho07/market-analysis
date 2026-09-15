/**
 * 🔄 Retry Utilities
 * Provides retry logic with exponential backoff and jitter
 */

import { sleep, calculateBackoff, sleepWithJitter } from "./sleep";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param options Retry configuration
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't delay after last attempt
      if (attempt === maxAttempts - 1) {
        break;
      }

      // Calculate backoff with jitter
      const backoffMs = calculateBackoff(attempt, baseDelay, maxDelay);
      const jitter = backoffMs * 0.2; // 20% jitter
      const delayMs = backoffMs + Math.random() * jitter;

      // Call retry callback
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      console.log(
        `⏳ Retry attempt ${attempt + 1}/${maxAttempts} after ${Math.round(delayMs)}ms...`
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable (rate limit or network error)
 */
export function isRetryableError(error: any): boolean {
  // Rate limit errors
  if (error.code === "RATE_LIMIT" || error.status === 429) {
    return true;
  }

  // Network errors
  if (
    error.code === "ECONNRESET" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ENOTFOUND"
  ) {
    return true;
  }

  // Server errors (5xx)
  if (error.status && error.status >= 500 && error.status < 600) {
    return true;
  }

  return false;
}

/**
 * Retry specifically for rate limit errors with longer backoff
 */
export async function retryWithRateLimit<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    baseDelay: 2000, // Start with 2 seconds
    maxDelay: 60000, // Max 1 minute
    shouldRetry: (error) => {
      // Retry on rate limits and network errors
      return (
        error.status === 429 ||
        error.code === "RATE_LIMIT" ||
        error.code === "ECONNRESET"
      );
    },
    onRetry: (attempt, error) => {
      console.log(
        `🚦 Rate limit hit (${error.status || error.code}), retrying...`
      );
    },
  });
}

/**
 * Retry with exponential backoff (simple wrapper)
 * @param fn Function to retry
 * @param maxAttempts Max retry attempts (default: 3)
 * @param baseDelay Base delay in ms (default: 300)
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 300
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    baseDelay,
    maxDelay: 10000, // Max 10 seconds
    shouldRetry: isRetryableError,
  });
}

