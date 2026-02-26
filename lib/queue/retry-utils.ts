export type RetryErrorType =
  | "TRANSIENT"
  | "PERMANENT"
  | "VALIDATION"
  | "RATE_LIMIT";

/**
 * Classify a textual error message into an error type that influences retry policy.
 */
export function classifyRetryError(errorMessage: string): RetryErrorType {
  const msg = (errorMessage || "").toLowerCase();

  if (msg.includes("validation")) return "VALIDATION";
  if (msg.includes("rate limit")) return "RATE_LIMIT";
  if (/timeout|econnreset|network|temporar/i.test(msg)) return "TRANSIENT";

  // default fallback: treat as permanent since we don't know how to handle it
  return "PERMANENT";
}

/**
 * Determine the maximum number of retries allowed for a given error type.
 */
export function maxRetriesForError(type: RetryErrorType): number {
  switch (type) {
    case "TRANSIENT":
      return 5;
    case "RATE_LIMIT":
      return 3;
    case "VALIDATION":
    case "PERMANENT":
      return 0;
  }
}
