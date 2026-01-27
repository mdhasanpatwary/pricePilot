/**
 * Proxy Simulator Service
 * 
 * Simulates various proxy behaviors and edge-case scenarios for testing without affecting production.
 * Provides comprehensive testing of proxy rotation, failure handling, exclusion, prioritization, and recovery.
 */

import { logger } from '../logger';
import { simulationRepository } from './simulation-repository';
import {
    SimulationConfig,
    SimulationResultData,
    SimulationRequest,
    SimulationSummary,
    ProxyConfig,
    FailureType,
} from '../types/admin-dashboard';

/**
 * Mock Proxy Manager for isolated testing
 * Simulates proxy manager behavior without making actual HTTP requests
 */
class MockProxyManager {
    private proxies: ProxyConfig[];
    private healthMap: Map<string, { isHealthy: boolean; failureCount: number; successCount: number }>;
    private excludedProxies: Set<string>;
    private currentIndex: number = 0;

    constructor(proxies: ProxyConfig[]) {
        this.proxies = proxies;
        this.healthMap = new Map();
        this.excludedProxies = new Set();

        // Initialize all proxies as healthy
        proxies.forEach(proxy => {
            this.healthMap.set(proxy.url, {
                isHealthy: true,
                failureCount: 0,
                successCount: 0,
            });
        });
    }

    /**
     * Select next proxy based on rotation strategy
     */
    selectProxy(excludeUrls: string[] = []): ProxyConfig | null {
        const availableProxies = this.proxies.filter(p => {
            const health = this.healthMap.get(p.url);
            return health?.isHealthy &&
                !this.excludedProxies.has(p.url) &&
                !excludeUrls.includes(p.url);
        });

        if (availableProxies.length === 0) {
            return null;
        }

        // Round-robin selection
        const proxy = availableProxies[this.currentIndex % availableProxies.length];
        this.currentIndex++;
        return proxy;
    }

    /**
     * Select proxy with prioritization (residential > datacenter)
     */
    selectProxyWithPriority(excludeUrls: string[] = []): ProxyConfig | null {
        const availableProxies = this.proxies.filter(p => {
            const health = this.healthMap.get(p.url);
            return health?.isHealthy &&
                !this.excludedProxies.has(p.url) &&
                !excludeUrls.includes(p.url);
        });

        if (availableProxies.length === 0) {
            return null;
        }

        // Sort by type priority and success rate
        availableProxies.sort((a, b) => {
            const aHealth = this.healthMap.get(a.url)!;
            const bHealth = this.healthMap.get(b.url)!;

            // Prioritize residential over datacenter
            if (a.type === 'residential' && b.type === 'datacenter') return -1;
            if (a.type === 'datacenter' && b.type === 'residential') return 1;

            // Then by success rate
            const aSuccessRate = aHealth.successCount / (aHealth.successCount + aHealth.failureCount) || 0;
            const bSuccessRate = bHealth.successCount / (bHealth.successCount + bHealth.failureCount) || 0;
            return bSuccessRate - aSuccessRate;
        });

        return availableProxies[0];
    }

    /**
     * Record success for a proxy
     */
    recordSuccess(proxyUrl: string): void {
        const health = this.healthMap.get(proxyUrl);
        if (health) {
            health.successCount++;
            health.failureCount = Math.max(0, health.failureCount - 1);

            // Restore health if failure count drops below threshold
            if (health.failureCount < 3) {
                health.isHealthy = true;
            }
        }
    }

    /**
     * Record failure for a proxy
     */
    recordFailure(proxyUrl: string): void {
        const health = this.healthMap.get(proxyUrl);
        if (health) {
            health.failureCount++;

            // Mark unhealthy if failure threshold exceeded
            if (health.failureCount >= 3) {
                health.isHealthy = false;
            }
        }
    }

    /**
     * Exclude a proxy from selection
     */
    excludeProxy(proxyUrl: string): void {
        this.excludedProxies.add(proxyUrl);
    }

    /**
     * Get all healthy proxies
     */
    getHealthyProxies(): ProxyConfig[] {
        return this.proxies.filter(p => {
            const health = this.healthMap.get(p.url);
            return health?.isHealthy && !this.excludedProxies.has(p.url);
        });
    }

    /**
     * Restore a proxy to healthy state (for recovery testing)
     */
    restoreProxy(proxyUrl: string): void {
        const health = this.healthMap.get(proxyUrl);
        if (health) {
            health.isHealthy = true;
            health.failureCount = 0;
            this.excludedProxies.delete(proxyUrl);
        }
    }

    /**
     * Get proxy health status
     */
    getProxyHealth(proxyUrl: string): { isHealthy: boolean; failureCount: number; successCount: number } | null {
        return this.healthMap.get(proxyUrl) || null;
    }
}

/**
 * Proxy Simulator Service
 * Runs isolated simulations of proxy behavior scenarios
 */
export class ProxySimulator {
    /**
     * Run a simulation based on configuration
     */
    async runSimulation(config: SimulationConfig): Promise<SimulationResultData> {
        const simulationId = crypto.randomUUID();
        const startTime = new Date();

        logger.info(`[ProxySimulator] Starting simulation ${simulationId}`, {
            scenario: config.scenario,
            requestCount: config.requestCount
        });

        // Validate configuration
        this.validateConfig(config);

        // Create mock proxy manager
        const mockProxyManager = new MockProxyManager(config.proxyPool);

        // Execute scenario
        let requests: SimulationRequest[];
        switch (config.scenario) {
            case 'rotation':
                requests = await this.simulateRotation(config, mockProxyManager);
                break;
            case 'failure':
                requests = await this.simulateFailure(config, mockProxyManager);
                break;
            case 'exclusion':
                requests = await this.simulateExclusion(config, mockProxyManager);
                break;
            case 'prioritization':
                requests = await this.simulatePrioritization(config, mockProxyManager);
                break;
            case 'recovery':
                requests = await this.simulateRecovery(config, mockProxyManager);
                break;
            case 'cascading_failure':
                requests = await this.simulateCascadingFailure(config, mockProxyManager);
                break;
            case 'all_fail':
                requests = await this.simulateAllFail(config, mockProxyManager);
                break;
            case 'single_success':
                requests = await this.simulateSingleSuccess(config, mockProxyManager);
                break;
            case 'intermittent':
                requests = await this.simulateIntermittent(config, mockProxyManager);
                break;
            default:
                throw new Error(`Unknown scenario: ${config.scenario}`);
        }

        const endTime = new Date();

        // Generate summary
        const summary = this.generateSummary(requests);

        // Generate recommendations
        const recommendations = this.generateRecommendations(config, requests, summary);

        // Create result
        const result: SimulationResultData = {
            id: simulationId,
            scenario: config.scenario,
            config,
            requests,
            summary,
            recommendations,
            startTime,
            endTime,
            createdAt: new Date(),
        };

        // Store in database
        await simulationRepository.createSimulation(result);

        logger.info(`[ProxySimulator] Completed simulation ${simulationId}`, {
            summary
        });

        return result;
    }

    /**
     * Get simulation result by ID
     */
    async getSimulationResult(id: string): Promise<SimulationResultData | null> {
        return await simulationRepository.getSimulation(id);
    }

    /**
     * List recent simulations
     */
    async listSimulations(limit: number = 50): Promise<SimulationResultData[]> {
        return await simulationRepository.listSimulations(limit);
    }

    /**
     * Validate simulation configuration
     */
    private validateConfig(config: SimulationConfig): void {
        if (!config.targetSite) {
            throw new Error('Target site is required');
        }

        if (!config.proxyPool || config.proxyPool.length === 0) {
            throw new Error('Proxy pool must contain at least one proxy');
        }

        if (config.requestCount <= 0) {
            throw new Error('Request count must be greater than 0');
        }

        if (config.failureRate !== undefined && (config.failureRate < 0 || config.failureRate > 1)) {
            throw new Error('Failure rate must be between 0 and 1');
        }
    }

    /**
     * Simulate proxy rotation scenario
     */
    private async simulateRotation(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];

        for (let i = 0; i < config.requestCount; i++) {
            const proxy = mockProxyManager.selectProxy();

            if (!proxy) {
                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: 'none',
                    success: false,
                    responseTime: 0,
                    error: 'No proxies available',
                    retryCount: 0,
                });
                continue;
            }

            // Simulate successful request
            const responseTime = this.generateResponseTime();
            mockProxyManager.recordSuccess(proxy.url);

            requests.push({
                requestNumber: i + 1,
                proxyUsed: proxy.url,
                success: true,
                responseTime,
                retryCount: 0,
            });

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Simulate proxy failure scenario
     */
    private async simulateFailure(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];
        const failureRate = config.failureRate || 0.3;

        for (let i = 0; i < config.requestCount; i++) {
            const proxy = mockProxyManager.selectProxy();

            if (!proxy) {
                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: 'none',
                    success: false,
                    responseTime: 0,
                    error: 'No proxies available',
                    retryCount: 0,
                });
                continue;
            }

            // Randomly fail based on failure rate
            const shouldFail = Math.random() < failureRate;

            if (shouldFail) {
                const error = this.generateError(config.failureType || 'timeout');
                mockProxyManager.recordFailure(proxy.url);

                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: proxy.url,
                    success: false,
                    responseTime: 0,
                    error,
                    retryCount: 0,
                });
            } else {
                const responseTime = this.generateResponseTime();
                mockProxyManager.recordSuccess(proxy.url);

                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: proxy.url,
                    success: true,
                    responseTime,
                    retryCount: 0,
                });
            }

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Simulate proxy exclusion scenario
     */
    private async simulateExclusion(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];

        // Exclude first proxy after initial requests
        const excludeAfter = Math.floor(config.requestCount / 3);

        for (let i = 0; i < config.requestCount; i++) {
            // Exclude first proxy after threshold
            if (i === excludeAfter && config.proxyPool.length > 0) {
                mockProxyManager.excludeProxy(config.proxyPool[0].url);
            }

            const proxy = mockProxyManager.selectProxy();

            if (!proxy) {
                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: 'none',
                    success: false,
                    responseTime: 0,
                    error: 'No proxies available',
                    retryCount: 0,
                });
                continue;
            }

            const responseTime = this.generateResponseTime();
            mockProxyManager.recordSuccess(proxy.url);

            requests.push({
                requestNumber: i + 1,
                proxyUsed: proxy.url,
                success: true,
                responseTime,
                retryCount: 0,
            });

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Simulate proxy prioritization scenario
     */
    private async simulatePrioritization(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];

        for (let i = 0; i < config.requestCount; i++) {
            const proxy = mockProxyManager.selectProxyWithPriority();

            if (!proxy) {
                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: 'none',
                    success: false,
                    responseTime: 0,
                    error: 'No proxies available',
                    retryCount: 0,
                });
                continue;
            }

            const responseTime = this.generateResponseTime();
            mockProxyManager.recordSuccess(proxy.url);

            requests.push({
                requestNumber: i + 1,
                proxyUsed: proxy.url,
                success: true,
                responseTime,
                retryCount: 0,
            });

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Simulate proxy recovery scenario
     */
    private async simulateRecovery(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];

        // Fail first proxy initially
        if (config.proxyPool.length > 0) {
            const firstProxy = config.proxyPool[0];
            mockProxyManager.recordFailure(firstProxy.url);
            mockProxyManager.recordFailure(firstProxy.url);
            mockProxyManager.recordFailure(firstProxy.url);
        }

        const recoveryPoint = Math.floor(config.requestCount / 2);

        for (let i = 0; i < config.requestCount; i++) {
            // Restore first proxy at recovery point
            if (i === recoveryPoint && config.proxyPool.length > 0) {
                mockProxyManager.restoreProxy(config.proxyPool[0].url);
            }

            const proxy = mockProxyManager.selectProxy();

            if (!proxy) {
                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: 'none',
                    success: false,
                    responseTime: 0,
                    error: 'No proxies available',
                    retryCount: 0,
                });
                continue;
            }

            const responseTime = this.generateResponseTime();
            mockProxyManager.recordSuccess(proxy.url);

            requests.push({
                requestNumber: i + 1,
                proxyUsed: proxy.url,
                success: true,
                responseTime,
                retryCount: 0,
            });

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Simulate cascading failure scenario
     */
    private async simulateCascadingFailure(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];
        let consecutiveFailures = 0;

        for (let i = 0; i < config.requestCount; i++) {
            const proxy = mockProxyManager.selectProxy();

            if (!proxy) {
                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: 'none',
                    success: false,
                    responseTime: 0,
                    error: 'No proxies available',
                    retryCount: 0,
                });
                continue;
            }

            // Increase failure probability with consecutive failures
            const failureProbability = Math.min(0.8, consecutiveFailures * 0.2);
            const shouldFail = Math.random() < failureProbability;

            if (shouldFail) {
                const error = this.generateError(config.failureType || 'timeout');
                mockProxyManager.recordFailure(proxy.url);
                consecutiveFailures++;

                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: proxy.url,
                    success: false,
                    responseTime: 0,
                    error,
                    retryCount: 0,
                });
            } else {
                const responseTime = this.generateResponseTime();
                mockProxyManager.recordSuccess(proxy.url);
                consecutiveFailures = 0;

                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: proxy.url,
                    success: true,
                    responseTime,
                    retryCount: 0,
                });
            }

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Simulate all proxies fail scenario
     */
    private async simulateAllFail(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];

        // Mark all proxies as unhealthy
        config.proxyPool.forEach(proxy => {
            mockProxyManager.recordFailure(proxy.url);
            mockProxyManager.recordFailure(proxy.url);
            mockProxyManager.recordFailure(proxy.url);
        });

        for (let i = 0; i < config.requestCount; i++) {
            const proxy = mockProxyManager.selectProxy();

            requests.push({
                requestNumber: i + 1,
                proxyUsed: proxy?.url || 'none',
                success: false,
                responseTime: 0,
                error: 'No healthy proxies available',
                retryCount: 0,
            });

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Simulate single proxy success scenario
     */
    private async simulateSingleSuccess(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];

        // Mark all proxies except last one as unhealthy
        for (let i = 0; i < config.proxyPool.length - 1; i++) {
            const proxy = config.proxyPool[i];
            mockProxyManager.recordFailure(proxy.url);
            mockProxyManager.recordFailure(proxy.url);
            mockProxyManager.recordFailure(proxy.url);
        }

        for (let i = 0; i < config.requestCount; i++) {
            const proxy = mockProxyManager.selectProxy();

            if (!proxy) {
                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: 'none',
                    success: false,
                    responseTime: 0,
                    error: 'No proxies available',
                    retryCount: 0,
                });
                continue;
            }

            const responseTime = this.generateResponseTime();
            mockProxyManager.recordSuccess(proxy.url);

            requests.push({
                requestNumber: i + 1,
                proxyUsed: proxy.url,
                success: true,
                responseTime,
                retryCount: 0,
            });

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Simulate intermittent failure scenario
     */
    private async simulateIntermittent(
        config: SimulationConfig,
        mockProxyManager: MockProxyManager
    ): Promise<SimulationRequest[]> {
        const requests: SimulationRequest[] = [];

        for (let i = 0; i < config.requestCount; i++) {
            const proxy = mockProxyManager.selectProxy();

            if (!proxy) {
                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: 'none',
                    success: false,
                    responseTime: 0,
                    error: 'No proxies available',
                    retryCount: 0,
                });
                continue;
            }

            // Alternate between success and failure
            const shouldFail = i % 3 === 0;

            if (shouldFail) {
                const error = this.generateError(config.failureType || 'timeout');
                mockProxyManager.recordFailure(proxy.url);

                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: proxy.url,
                    success: false,
                    responseTime: 0,
                    error,
                    retryCount: 0,
                });
            } else {
                const responseTime = this.generateResponseTime();
                mockProxyManager.recordSuccess(proxy.url);

                requests.push({
                    requestNumber: i + 1,
                    proxyUsed: proxy.url,
                    success: true,
                    responseTime,
                    retryCount: 0,
                });
            }

            await this.delay(config.delayBetweenRequests || 0);
        }

        return requests;
    }

    /**
     * Generate summary from simulation requests
     */
    private generateSummary(requests: SimulationRequest[]): SimulationSummary {
        const successfulRequests = requests.filter(r => r.success).length;
        const failedRequests = requests.filter(r => !r.success).length;

        const responseTimes = requests
            .filter(r => r.success)
            .map(r => r.responseTime);

        const averageResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            : 0;

        const uniqueProxies = new Set(requests.map(r => r.proxyUsed));
        const rotationPattern = requests.map(r => r.proxyUsed);

        return {
            totalRequests: requests.length,
            successfulRequests,
            failedRequests,
            averageResponseTime,
            proxiesUsed: uniqueProxies.size,
            rotationPattern,
        };
    }

    /**
     * Generate recommendations based on simulation results
     */
    private generateRecommendations(
        config: SimulationConfig,
        _requests: SimulationRequest[],
        summary: SimulationSummary
    ): string[] {
        const recommendations: string[] = [];

        const successRate = summary.successfulRequests / summary.totalRequests;

        // Success rate recommendations
        if (successRate < 0.5) {
            recommendations.push('Critical: Success rate is below 50%. Consider adding more proxies or investigating proxy quality.');
        } else if (successRate < 0.8) {
            recommendations.push('Warning: Success rate is below 80%. Monitor proxy health and consider adding backup proxies.');
        } else if (successRate >= 0.95) {
            recommendations.push('Excellent: Success rate is above 95%. Current proxy configuration is performing well.');
        }

        // Proxy pool size recommendations
        if (config.proxyPool.length < 3) {
            recommendations.push('Consider increasing proxy pool size to at least 3 proxies for better redundancy.');
        }

        // Proxy type recommendations
        const residentialCount = config.proxyPool.filter(p => p.type === 'residential').length;
        const datacenterCount = config.proxyPool.filter(p => p.type === 'datacenter').length;

        if (residentialCount === 0 && datacenterCount > 0) {
            recommendations.push('Consider adding residential proxies for better success rates on sites with strict anti-bot protection.');
        }

        // Scenario-specific recommendations
        switch (config.scenario) {
            case 'all_fail':
                recommendations.push('All proxies failed. Verify proxy credentials and connectivity before production use.');
                break;
            case 'single_success':
                recommendations.push('Only one proxy succeeded. Add more reliable proxies to improve redundancy.');
                break;
            case 'cascading_failure':
                recommendations.push('Cascading failures detected. Implement circuit breaker pattern to prevent proxy pool exhaustion.');
                break;
            case 'intermittent':
                recommendations.push('Intermittent failures detected. Consider implementing retry logic with exponential backoff.');
                break;
        }

        // Response time recommendations
        if (summary.averageResponseTime > 5000) {
            recommendations.push('Average response time is high (>5s). Consider using faster proxies or optimizing request handling.');
        }

        return recommendations;
    }

    /**
     * Generate realistic response time (100-3000ms)
     */
    private generateResponseTime(): number {
        return Math.floor(Math.random() * 2900) + 100;
    }

    /**
     * Generate error message based on failure type
     */
    private generateError(failureType: FailureType): string {
        switch (failureType) {
            case 'timeout':
                return 'Request timeout after 30 seconds';
            case 'connection_refused':
                return 'Connection refused by proxy server';
            case 'http_error':
                return `HTTP ${Math.floor(Math.random() * 3) + 5}00 error`;
            case 'challenge':
                return 'Challenge detected and failed to solve';
            default:
                return 'Unknown error';
        }
    }

    /**
     * Delay execution
     */
    private async delay(ms: number): Promise<void> {
        if (ms > 0) {
            await new Promise(resolve => setTimeout(resolve, ms));
        }
    }
}

// Export singleton instance
export const proxySimulator = new ProxySimulator();
