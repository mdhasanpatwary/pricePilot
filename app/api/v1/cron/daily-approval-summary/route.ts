import { withRequestContextOnly } from '@/lib/middleware/with-request-context';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/lib/services/email";

/**
 * GET /api/v1/cron/daily-approval-summary
 * Send daily approval summary emails to all tenants
 * 
 * This endpoint should be called by a cron job (e.g., daily at 8 AM via Vercel Cron).
 * It loads all tenants from the database and sends daily approval summaries to users
 * with email notifications enabled.
 * 
 * ## Configuration
 * 
 * ### Vercel Cron (vercel.json)
 * ```json
 * {
 *   "crons": [
 *     {
 *       "path": "/api/v1/cron/daily-approval-summary",
 *       "schedule": "0 8 * * *"
 *     }
 *   ]
 * }
 * ```
 * 
 * Schedule: Daily at 8:00 AM UTC
 * 
 * ### Environment Variables
 * - `CRON_SECRET`: Required for authentication (set in .env)
 * - `NEXTAUTH_URL`: Base URL for dashboard links in emails
 * 
 * ## Manual Trigger (for testing)
 * ```bash
 * curl https://your-domain.com/api/v1/cron/daily-approval-summary \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 * ```
 * 
 * ## Response Format
 * ```json
 * {
 *   "success": true,
 *   "message": "Sent daily summaries to 5 tenants",
 *   "data": {
 *     "totalTenantsProcessed": 5,
 *     "totalEmailsSent": 12,
 *     "results": [
 *       {
 *         "tenantId": "uuid",
 *         "tenantName": "Company Name",
 *         "emailsSent": 3,
 *         "status": "success"
 *       }
 *     ]
 *   }
 * }
 * ```
 * 
 * ## Email Content
 * The daily summary email includes:
 * - Manually approved changes (yesterday)
 * - Auto-approved changes (yesterday)
 * - Rejected changes (yesterday)
 * - Still pending changes (current)
 * 
 * ## Behavior
 * - Only sends emails to users with `emailNotifications: true`
 * - Skips tenants with no activity (0 approved, 0 rejected, 0 pending)
 * - Errors per tenant are caught and logged, but processing continues for other tenants
 * 
 * Requirements: 2.10.2
 * Task: 11.6 - Create email notification cron jobs
 */
async function handleGET(req: NextRequest) {
    try {
        // Verify cron secret for security
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

        // Load all tenants from database
        const tenants = await prisma.tenant.findMany({
            select: {
                id: true,
                companyName: true,
            },
        });

        let totalTenantsProcessed = 0;
        let totalEmailsSent = 0;
        const results: Array<{
            tenantId: string;
            tenantName: string;
            emailsSent: number;
            status: "success" | "error" | "skipped";
            error?: string;
        }> = [];

        // Process daily summaries for each tenant
        for (const tenant of tenants) {
            try {
                // Count users with email notifications enabled for this tenant
                const usersWithNotifications = await prisma.user.count({
                    where: {
                        tenantId: tenant.id,
                        emailNotifications: true,
                    },
                });

                // Skip if no users have notifications enabled
                if (usersWithNotifications === 0) {
                    results.push({
                        tenantId: tenant.id,
                        tenantName: tenant.companyName,
                        emailsSent: 0,
                        status: "skipped",
                    });
                    continue;
                }

                // Send daily approval summary
                await EmailService.sendDailyApprovalSummary(tenant.id);

                totalTenantsProcessed++;
                totalEmailsSent += usersWithNotifications;

                results.push({
                    tenantId: tenant.id,
                    tenantName: tenant.companyName,
                    emailsSent: usersWithNotifications,
                    status: "success",
                });

                // Log success for monitoring
                if (process.env.NODE_ENV !== "test") {
                    console.log(
                        `[DailySummary Cron] Sent summary to ${tenant.companyName}: ${usersWithNotifications} emails`
                    );
                }
            } catch (error) {
                // Catch and log errors per tenant, continue processing others
                const errorMessage = error instanceof Error ? error.message : String(error);

                results.push({
                    tenantId: tenant.id,
                    tenantName: tenant.companyName,
                    emailsSent: 0,
                    status: "error",
                    error: errorMessage,
                });

                // Log error but continue processing
                if (process.env.NODE_ENV !== "test") {
                    console.error(
                        `[DailySummary Cron] Error processing tenant ${tenant.companyName}:`,
                        error
                    );
                }
            }
        }

        // Return summary
        return NextResponse.json({
            success: true,
            message: `Sent daily summaries to ${totalTenantsProcessed} tenants`,
            data: {
                totalTenantsProcessed,
                totalEmailsSent,
                results,
            },
        });
    } catch (error) {
        console.error("[DailySummary Cron] Fatal error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to send daily summaries",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextOnly(req, handleGET);
}
