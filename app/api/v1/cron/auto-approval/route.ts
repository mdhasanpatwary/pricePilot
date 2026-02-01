import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AutoApprovalService } from "@/lib/services/auto-approval";

/**
 * GET /api/v1/cron/auto-approval
 * Process auto-approval rules for all tenants
 * 
 * This endpoint should be called by a cron job (e.g., hourly via Vercel Cron).
 * It loads all tenants from the database and processes auto-approvals for each.
 * 
 * ## Configuration
 * 
 * ### Vercel Cron (vercel.json)
 * ```json
 * {
 *   "crons": [
 *     {
 *       "path": "/api/v1/cron/auto-approval",
 *       "schedule": "0 * * * *"
 *     }
 *   ]
 * }
 * ```
 * 
 * ### Environment Variables
 * - `CRON_SECRET`: Required for authentication (set in .env)
 * 
 * ## Manual Trigger (for testing)
 * ```bash
 * curl https://your-domain.com/api/v1/cron/auto-approval \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 * ```
 * 
 * ## Response Format
 * ```json
 * {
 *   "success": true,
 *   "message": "Processed 5 tenants, auto-approved 12 changes",
 *   "data": {
 *     "totalTenantsProcessed": 5,
 *     "totalChangesAutoApproved": 12,
 *     "results": [
 *       {
 *         "tenantId": "uuid",
 *         "tenantName": "Company Name",
 *         "autoApprovedCount": 3,
 *         "status": "success"
 *       }
 *     ]
 *   }
 * }
 * ```
 * 
 * ## Error Handling
 * - Errors per tenant are caught and logged, but processing continues for other tenants
 * - Each tenant's result includes a status field ("success" or "error")
 * - Failed tenants include an error message in the results
 * 
 * Requirements: 5.1, 5.2, 5.5
 */
export async function GET(req: NextRequest) {
    try {
        // Verify cron secret for security (Requirement 5.1)
        const authHeader = req.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized"
                },
                { status: 401 }
            );
        }

        // Load all tenants from database (Requirement 5.2)
        const tenants = await prisma.tenant.findMany({
            select: {
                id: true,
                companyName: true,
            },
        });

        let totalTenantsProcessed = 0;
        let totalChangesAutoApproved = 0;
        const results: Array<{
            tenantId: string;
            tenantName: string;
            autoApprovedCount: number;
            status: "success" | "error";
            error?: string;
        }> = [];

        // Process auto-approvals for each tenant (Requirement 5.2)
        for (const tenant of tenants) {
            try {
                // Call AutoApprovalService.processAutoApprovals() for each tenant
                const autoApprovedCount = await AutoApprovalService.processAutoApprovals(
                    tenant.id
                );

                totalTenantsProcessed++;
                totalChangesAutoApproved += autoApprovedCount;

                results.push({
                    tenantId: tenant.id,
                    tenantName: tenant.companyName,
                    autoApprovedCount,
                    status: "success",
                });

                // Log success for monitoring
                if (process.env.NODE_ENV !== "test") {
                    console.log(
                        `[AutoApproval Cron] Processed tenant ${tenant.companyName}: ${autoApprovedCount} changes auto-approved`
                    );
                }
            } catch (error) {
                // Catch and log errors per tenant, continue processing others (Requirement 5.5)
                const errorMessage = error instanceof Error ? error.message : String(error);

                results.push({
                    tenantId: tenant.id,
                    tenantName: tenant.companyName,
                    autoApprovedCount: 0,
                    status: "error",
                    error: errorMessage,
                });

                // Log error but continue processing
                if (process.env.NODE_ENV !== "test") {
                    console.error(
                        `[AutoApproval Cron] Error processing tenant ${tenant.companyName}:`,
                        error
                    );
                }
            }
        }

        // Return summary (Requirement 5.4)
        return NextResponse.json({
            success: true,
            message: `Processed ${totalTenantsProcessed} tenants, auto-approved ${totalChangesAutoApproved} changes`,
            data: {
                totalTenantsProcessed,
                totalChangesAutoApproved,
                results,
            },
        });
    } catch (error) {
        console.error("[AutoApproval Cron] Fatal error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to process auto-approvals",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
