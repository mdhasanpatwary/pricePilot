import { prisma } from "@/lib/prisma";
import {
    SimulationResultData,
    SimulationScenario,
    SimulationConfig,
    SimulationRequest,
    SimulationSummary
} from "@/lib/types/admin-dashboard";
import { logger } from "@/lib/logger";

/**
 * Repository for SimulationResult database operations
 * Handles persistence of proxy simulation data
 */
export class SimulationRepository {
    /**
     * Create a new simulation result
     */
    async createSimulation(data: {
        id: string;
        scenario: SimulationScenario;
        config: SimulationConfig;
        requests: SimulationRequest[];
        summary: SimulationSummary;
        recommendations: string[];
        startTime: Date;
        endTime: Date;
    }): Promise<SimulationResultData> {
        try {
            const simulation = await prisma.simulationResult.create({
                data: {
                    id: data.id,
                    scenario: data.scenario,
                    config: data.config as any,
                    requests: data.requests as any,
                    summary: data.summary as any,
                    recommendations: data.recommendations as any,
                    startTime: data.startTime,
                    endTime: data.endTime,
                },
            });

            return this.mapToSimulationData(simulation);
        } catch (error) {
            logger.error("[SimulationRepository] Error creating simulation", { error, data });
            throw error;
        }
    }

    /**
     * Get simulation by ID
     */
    async getSimulation(simulationId: string): Promise<SimulationResultData | null> {
        try {
            const simulation = await prisma.simulationResult.findUnique({
                where: { id: simulationId },
            });

            return simulation ? this.mapToSimulationData(simulation) : null;
        } catch (error) {
            logger.error("[SimulationRepository] Error getting simulation", { error, simulationId });
            return null;
        }
    }

    /**
     * List recent simulations
     */
    async listSimulations(limit: number = 50, scenario?: SimulationScenario): Promise<SimulationResultData[]> {
        try {
            const where: any = {};
            if (scenario) {
                where.scenario = scenario;
            }

            const simulations = await prisma.simulationResult.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
            });

            return simulations.map(s => this.mapToSimulationData(s));
        } catch (error) {
            logger.error("[SimulationRepository] Error listing simulations", { error, limit, scenario });
            return [];
        }
    }

    /**
     * Delete old simulations (cleanup)
     */
    async deleteOldSimulations(olderThanDays: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const result = await prisma.simulationResult.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                },
            });

            return result.count;
        } catch (error) {
            logger.error("[SimulationRepository] Error deleting old simulations", { error, olderThanDays });
            return 0;
        }
    }

    /**
     * Get simulation count by scenario
     */
    async getSimulationCountByScenario(): Promise<Record<string, number>> {
        try {
            const simulations = await prisma.simulationResult.groupBy({
                by: ['scenario'],
                _count: true,
            });

            const counts: Record<string, number> = {};
            simulations.forEach(s => {
                counts[s.scenario] = s._count;
            });

            return counts;
        } catch (error) {
            logger.error("[SimulationRepository] Error getting simulation count by scenario", { error });
            return {};
        }
    }

    /**
     * Map Prisma model to typed interface
     */
    private mapToSimulationData(simulation: any): SimulationResultData {
        return {
            id: simulation.id,
            scenario: simulation.scenario as SimulationScenario,
            config: simulation.config as SimulationConfig,
            requests: simulation.requests as SimulationRequest[],
            summary: simulation.summary as SimulationSummary,
            recommendations: simulation.recommendations as string[] || [],
            startTime: simulation.startTime,
            endTime: simulation.endTime,
            createdAt: simulation.createdAt,
        };
    }
}

// Export singleton instance
export const simulationRepository = new SimulationRepository();
