

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class RedisCircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;

  // Configuration
  private readonly failureThreshold = 3;
  private readonly resetTimeoutMs = 15000; // 15 seconds before trying HALF_OPEN

  // Singleton instance
  private static instance: RedisCircuitBreaker;

  private constructor() {}

  public static getInstance(): RedisCircuitBreaker {
    if (!RedisCircuitBreaker.instance) {
      RedisCircuitBreaker.instance = new RedisCircuitBreaker();
    }
    return RedisCircuitBreaker.instance;
  }

  public isOpen(): boolean {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        // Time to test if Redis is back
        this.transitionTo("HALF_OPEN");
        return false;
      }
      return true; // Still open, fast-fail
    }
    return false; // CLOSED or HALF_OPEN allow attempts
  }

  public recordSuccess() {
    if (this.state !== "CLOSED") {
      this.transitionTo("CLOSED");
    }
  }

  public recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Immediate fallback to OPEN if it fails during HALF_OPEN
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED" && this.failureCount >= this.failureThreshold) {
      this.transitionTo("OPEN");
    }
  }

  private transitionTo(newState: CircuitBreakerState) {
    if (this.state !== newState) {
      console.warn(`[RedisCircuitBreaker] State transitioned: ${this.state} -> ${newState}`);
      this.state = newState;

      if (newState === "CLOSED") {
        this.failureCount = 0;
      }
    }
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }
}

// Helper to wrap Redis calls with Circuit Breaker
export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T> | T
): Promise<T> {
  const cb = RedisCircuitBreaker.getInstance();

  if (cb.isOpen()) {
    return fallback();
  }

  try {
    const result = await operation();
    cb.recordSuccess();
    return result;
  } catch (error) {
    cb.recordFailure();
    return fallback();
  }
}
