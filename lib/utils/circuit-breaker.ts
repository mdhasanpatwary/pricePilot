/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by temporarily disabling failing services
 */

export enum CircuitState {
    CLOSED = "CLOSED",     // Normal operation
    OPEN = "OPEN",         // Circuit is open, requests fail fast
    HALF_OPEN = "HALF_OPEN" // Testing if service has recovered
}

export interface CircuitBreakerOptions {
    failureThreshold: number;    // Number of failures before opening
    recoveryTimeout: number;     // Time to wait before trying again (ms)
    monitoringPeriod: number;    // Time window for failure counting (ms)
    halfOpenMaxCalls: number;    // Max calls to allow in half-open state
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private halfOpenCalls: number = 0;
    private readonly options: CircuitBreakerOptions;

    constructor(options: Partial<CircuitBreakerOptions> = {}) {
        this.options = {
            failureThreshold: 5,
            recoveryTimeout: 60000, // 1 minute
            monitoringPeriod: 300000, // 5 minutes
            halfOpenMaxCalls: 3,
            ...options,
        };
    }

    async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenCalls = 0;
            } else {
                if (fallback) {
                    return await fallback();
                }
                throw new Error(`Circuit breaker is OPEN. Service unavailable.`);
            }
        }

        if (this.state === CircuitState.HALF_OPEN) {
            if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
                throw new Error(`Circuit breaker HALF_OPEN limit exceeded.`);
            }
            this.halfOpenCalls++;
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        this.state = CircuitState.CLOSED;
        this.halfOpenCalls = 0;
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.options.failureThreshold) {
            this.state = CircuitState.OPEN;
        }
    }

    private shouldAttemptReset(): boolean {
        return Date.now() - this.lastFailureTime >= this.options.recoveryTimeout;
    }

    public getState(): CircuitState {
        return this.state;
    }

    public getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
            halfOpenCalls: this.halfOpenCalls,
        };
    }

    public reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.halfOpenCalls = 0;
    }
}

/**
 * Global circuit breaker registry for different services
 */
class CircuitBreakerRegistry {
    private breakers = new Map<string, CircuitBreaker>();

    getBreaker(key: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
        if (!this.breakers.has(key)) {
            this.breakers.set(key, new CircuitBreaker(options));
        }
        return this.breakers.get(key)!;
    }

    getAllBreakers(): Map<string, CircuitBreaker> {
        return this.breakers;
    }

    resetAll(): void {
        this.breakers.forEach(breaker => breaker.reset());
    }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();