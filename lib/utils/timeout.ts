/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message
 * @returns Promise that rejects if timeout is exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = `Operation timed out after ${timeoutMs}ms`,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
    ),
  ]);
}

/**
 * Retries a promise-returning function with exponential backoff
 * @param fn Function that returns a promise
 * @param maxRetries Maximum number of retry attempts
 * @param timeoutMs Timeout for each attempt in milliseconds
 * @param retryDelayMs Initial delay between retries (doubles each time)
 * @returns Promise that resolves with the result or rejects after all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  timeoutMs: number = 45000,
  retryDelayMs: number = 2000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try with timeout
      const result = await withTimeout(
        fn(),
        timeoutMs,
        `Attempt ${attempt}/${maxRetries} timed out after ${timeoutMs}ms`,
      );
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      const delay = retryDelayMs * Math.pow(2, attempt - 1);
      console.log(
        `[Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
