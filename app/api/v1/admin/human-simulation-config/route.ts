import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface HumanSimulationConfig {
    typing: {
        minDelay: number;
        maxDelay: number;
    };
    actionPause: {
        minDelay: number;
        maxDelay: number;
    };
    mouseMovement: {
        enabled: boolean;
        naturalCurves: boolean;
    };
    formInteraction: {
        pauseBetweenFields: number;
        simulateCorrections: boolean;
    };
}

// Default configuration values
const DEFAULT_CONFIG: HumanSimulationConfig = {
    typing: {
        minDelay: 50,
        maxDelay: 150
    },
    actionPause: {
        minDelay: 100,
        maxDelay: 2000
    },
    mouseMovement: {
        enabled: true,
        naturalCurves: true
    },
    formInteraction: {
        pauseBetweenFields: 500,
        simulateCorrections: true
    }
};

/**
 * GET /api/v1/admin/human-simulation-config
 * Get current human simulation configuration
 * 
 * Requirements: 8.5, 5.1
 */
export async function GET() {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;
        
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
        }

        // Fetch configuration from database
        const configRecord = await prisma.humanSimulationConfig.findFirst({
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // If no config exists, return defaults
        if (!configRecord) {
            return NextResponse.json({
                success: true,
                data: {
                    config: DEFAULT_CONFIG,
                    isDefault: true
                }
            });
        }

        // Format configuration
        const config: HumanSimulationConfig = {
            typing: {
                minDelay: configRecord.typingMinDelay,
                maxDelay: configRecord.typingMaxDelay
            },
            actionPause: {
                minDelay: configRecord.actionPauseMin,
                maxDelay: configRecord.actionPauseMax
            },
            mouseMovement: {
                enabled: configRecord.mouseMovementEnabled,
                naturalCurves: configRecord.naturalCurvesEnabled
            },
            formInteraction: {
                pauseBetweenFields: configRecord.pauseBetweenFields,
                simulateCorrections: configRecord.simulateCorrections
            }
        };

        return NextResponse.json({
            success: true,
            data: {
                config,
                isDefault: false,
                lastUpdated: configRecord.updatedAt.toISOString()
            }
        });

    } catch (error) {
        console.error("[HumanSimulationConfig API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch human simulation configuration",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/v1/admin/human-simulation-config
 * Update human simulation configuration
 * 
 * Requirements: 8.6, 5.5, 5.6
 */
export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;
        
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const { config } = body;

        if (!config) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Configuration object is required"
                },
                { status: 400 }
            );
        }

        // Validate configuration
        const errors: string[] = [];

        // Validate typing delays
        if (config.typing) {
            if (typeof config.typing.minDelay !== 'number' || config.typing.minDelay < 0) {
                errors.push("Typing minDelay must be a non-negative number");
            }
            if (typeof config.typing.maxDelay !== 'number' || config.typing.maxDelay < 0) {
                errors.push("Typing maxDelay must be a non-negative number");
            }
            if (config.typing.minDelay > config.typing.maxDelay) {
                errors.push("Typing minDelay cannot be greater than maxDelay");
            }
            if (config.typing.minDelay < 10 || config.typing.minDelay > 500) {
                errors.push("Typing minDelay should be between 10ms and 500ms");
            }
            if (config.typing.maxDelay < 50 || config.typing.maxDelay > 1000) {
                errors.push("Typing maxDelay should be between 50ms and 1000ms");
            }
        }

        // Validate action pauses
        if (config.actionPause) {
            if (typeof config.actionPause.minDelay !== 'number' || config.actionPause.minDelay < 0) {
                errors.push("Action pause minDelay must be a non-negative number");
            }
            if (typeof config.actionPause.maxDelay !== 'number' || config.actionPause.maxDelay < 0) {
                errors.push("Action pause maxDelay must be a non-negative number");
            }
            if (config.actionPause.minDelay > config.actionPause.maxDelay) {
                errors.push("Action pause minDelay cannot be greater than maxDelay");
            }
            if (config.actionPause.minDelay < 50 || config.actionPause.minDelay > 5000) {
                errors.push("Action pause minDelay should be between 50ms and 5000ms");
            }
            if (config.actionPause.maxDelay < 100 || config.actionPause.maxDelay > 10000) {
                errors.push("Action pause maxDelay should be between 100ms and 10000ms");
            }
        }

        // Validate mouse movement settings
        if (config.mouseMovement) {
            if (typeof config.mouseMovement.enabled !== 'boolean') {
                errors.push("Mouse movement enabled must be a boolean");
            }
            if (typeof config.mouseMovement.naturalCurves !== 'boolean') {
                errors.push("Mouse movement naturalCurves must be a boolean");
            }
        }

        // Validate form interaction settings
        if (config.formInteraction) {
            if (typeof config.formInteraction.pauseBetweenFields !== 'number' || config.formInteraction.pauseBetweenFields < 0) {
                errors.push("Form interaction pauseBetweenFields must be a non-negative number");
            }
            if (config.formInteraction.pauseBetweenFields < 100 || config.formInteraction.pauseBetweenFields > 5000) {
                errors.push("Form interaction pauseBetweenFields should be between 100ms and 5000ms");
            }
            if (typeof config.formInteraction.simulateCorrections !== 'boolean') {
                errors.push("Form interaction simulateCorrections must be a boolean");
            }
        }

        // Return validation errors if any
        if (errors.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Validation failed",
                    errors
                },
                { status: 400 }
            );
        }

        // Update or create configuration in database
        const existingConfig = await prisma.humanSimulationConfig.findFirst({
            orderBy: {
                updatedAt: 'desc'
            }
        });

        let updatedConfig;

        if (existingConfig) {
            // Update existing configuration
            updatedConfig = await prisma.humanSimulationConfig.update({
                where: {
                    id: existingConfig.id
                },
                data: {
                    typingMinDelay: config.typing.minDelay,
                    typingMaxDelay: config.typing.maxDelay,
                    actionPauseMin: config.actionPause.minDelay,
                    actionPauseMax: config.actionPause.maxDelay,
                    mouseMovementEnabled: config.mouseMovement.enabled,
                    naturalCurvesEnabled: config.mouseMovement.naturalCurves,
                    pauseBetweenFields: config.formInteraction.pauseBetweenFields,
                    simulateCorrections: config.formInteraction.simulateCorrections
                }
            });
        } else {
            // Create new configuration
            updatedConfig = await prisma.humanSimulationConfig.create({
                data: {
                    typingMinDelay: config.typing.minDelay,
                    typingMaxDelay: config.typing.maxDelay,
                    actionPauseMin: config.actionPause.minDelay,
                    actionPauseMax: config.actionPause.maxDelay,
                    mouseMovementEnabled: config.mouseMovement.enabled,
                    naturalCurvesEnabled: config.mouseMovement.naturalCurves,
                    pauseBetweenFields: config.formInteraction.pauseBetweenFields,
                    simulateCorrections: config.formInteraction.simulateCorrections
                }
            });
        }

        // Format response
        const responseConfig: HumanSimulationConfig = {
            typing: {
                minDelay: updatedConfig.typingMinDelay,
                maxDelay: updatedConfig.typingMaxDelay
            },
            actionPause: {
                minDelay: updatedConfig.actionPauseMin,
                maxDelay: updatedConfig.actionPauseMax
            },
            mouseMovement: {
                enabled: updatedConfig.mouseMovementEnabled,
                naturalCurves: updatedConfig.naturalCurvesEnabled
            },
            formInteraction: {
                pauseBetweenFields: updatedConfig.pauseBetweenFields,
                simulateCorrections: updatedConfig.simulateCorrections
            }
        };

        return NextResponse.json({
            success: true,
            data: {
                config: responseConfig,
                lastUpdated: updatedConfig.updatedAt.toISOString()
            },
            message: "Configuration updated successfully"
        });

    } catch (error) {
        console.error("[HumanSimulationConfig API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to update human simulation configuration",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
