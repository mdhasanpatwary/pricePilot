/**
 * Connection Pool for HTTP Requests
 * 
 * Manages HTTP connection pooling to reuse connections for API requests,
 * improving performance by reducing connection overhead.
 */

import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
    /** Maximum number of sockets per host */
    maxSockets: number;
    /** Maximum number of free sockets to keep open */
    maxFreeSockets: number;
    /** Socket timeout in milliseconds */
    timeout: number;
    /** Keep-alive timeout in milliseconds */
    keepAliveTimeout: number;
    /** Enable keep-alive */
    keepAlive: boolean;
}

/**
 * Default connection pool configuration
 */
const DEFAULT_CONFIG: ConnectionPoolConfig = {
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    keepAliveTimeout: 30000,
    keepAlive: true,
};

/**
 * ConnectionPool class
 * 
 * Provides HTTP and HTTPS agents with connection pooling for efficient
 * request handling. Reuses connections to reduce overhead.
 */
export class ConnectionPool {
    private httpAgent: HttpAgent;
    private httpsAgent: HttpsAgent;
    private config: ConnectionPoolConfig;

    constructor(config?: Partial<ConnectionPoolConfig>) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };

        // Create HTTP agent with pooling
        this.httpAgent = new HttpAgent({
            keepAlive: this.config.keepAlive,
            keepAliveMsecs: this.config.keepAliveTimeout,
            maxSockets: this.config.maxSockets,
            maxFreeSockets: this.config.maxFreeSockets,
            timeout: this.config.timeout,
        });

        // Create HTTPS agent with pooling
        this.httpsAgent = new HttpsAgent({
            keepAlive: this.config.keepAlive,
            keepAliveMsecs: this.config.keepAliveTimeout,
            maxSockets: this.config.maxSockets,
            maxFreeSockets: this.config.maxFreeSockets,
            timeout: this.config.timeout,
        });
    }

    /**
     * Get HTTP agent for connection pooling
     * 
     * @returns HTTP agent instance
     */
    getHttpAgent(): HttpAgent {
        return this.httpAgent;
    }

    /**
     * Get HTTPS agent for connection pooling
     * 
     * @returns HTTPS agent instance
     */
    getHttpsAgent(): HttpsAgent {
        return this.httpsAgent;
    }

    /**
     * Get appropriate agent for URL
     * 
     * @param url - Request URL
     * @returns HTTP or HTTPS agent based on protocol
     */
    getAgentForUrl(url: string): HttpAgent | HttpsAgent {
        const protocol = new URL(url).protocol;
        return protocol === 'https:' ? this.httpsAgent : this.httpAgent;
    }

    /**
     * Get current pool statistics
     * 
     * @returns Pool statistics
     */
    getStats(): {
        http: {
            sockets: number;
            freeSockets: number;
            requests: number;
        };
        https: {
            sockets: number;
            freeSockets: number;
            requests: number;
        };
    } {
        return {
            http: {
                sockets: Object.keys((this.httpAgent as any).sockets || {}).length,
                freeSockets: Object.keys((this.httpAgent as any).freeSockets || {}).length,
                requests: Object.keys((this.httpAgent as any).requests || {}).length,
            },
            https: {
                sockets: Object.keys((this.httpsAgent as any).sockets || {}).length,
                freeSockets: Object.keys((this.httpsAgent as any).freeSockets || {}).length,
                requests: Object.keys((this.httpsAgent as any).requests || {}).length,
            },
        };
    }

    /**
     * Update pool configuration
     * 
     * @param config - New configuration (partial)
     */
    updateConfig(config: Partial<ConnectionPoolConfig>): void {
        this.config = {
            ...this.config,
            ...config,
        };

        // Update agents with new config
        (this.httpAgent as any).maxSockets = this.config.maxSockets;
        (this.httpAgent as any).maxFreeSockets = this.config.maxFreeSockets;
        (this.httpAgent as any).timeout = this.config.timeout;

        (this.httpsAgent as any).maxSockets = this.config.maxSockets;
        (this.httpsAgent as any).maxFreeSockets = this.config.maxFreeSockets;
        (this.httpsAgent as any).timeout = this.config.timeout;
    }

    /**
     * Destroy all connections and cleanup
     */
    destroy(): void {
        this.httpAgent.destroy();
        this.httpsAgent.destroy();
    }

    /**
     * Close idle connections
     */
    closeIdleConnections(): void {
        // Close free sockets
        const httpFreeSockets = (this.httpAgent as any).freeSockets || {};
        Object.values(httpFreeSockets).forEach((sockets: any) => {
            if (Array.isArray(sockets)) {
                sockets.forEach((socket: any) => socket.destroy());
            }
        });

        const httpsFreeSockets = (this.httpsAgent as any).freeSockets || {};
        Object.values(httpsFreeSockets).forEach((sockets: any) => {
            if (Array.isArray(sockets)) {
                sockets.forEach((socket: any) => socket.destroy());
            }
        });
    }
}

/**
 * Global connection pool instance
 */
let globalPool: ConnectionPool | null = null;

/**
 * Get or create global connection pool
 * 
 * @param config - Optional configuration for new pool
 * @returns Global connection pool instance
 */
export function getGlobalConnectionPool(
    config?: Partial<ConnectionPoolConfig>
): ConnectionPool {
    if (!globalPool) {
        globalPool = new ConnectionPool(config);
    }
    return globalPool;
}

/**
 * Destroy global connection pool
 */
export function destroyGlobalConnectionPool(): void {
    if (globalPool) {
        globalPool.destroy();
        globalPool = null;
    }
}
