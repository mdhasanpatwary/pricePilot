import { NextRequest, NextResponse } from "next/server";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/admin/export/sessions
 * Export session data in specified format
 *
 * Query Parameters:
 * - format: json | csv | pdf (default: json)
 * - tenantId: Filter by tenant (optional)
 * - status: Filter by status (optional)
 * - startDate: Filter by start date (optional)
 * - endDate: Filter by end date (optional)
 *
 * Requirements: 15.1, 15.5
 */
async function handleGET(request: NextRequest) {
    try {
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const format = (searchParams.get("format") || "json") as "json" | "csv" | "pdf";
        const tenantId = searchParams.get("tenantId") || undefined;
        const status = searchParams.get("status") || undefined;
        const startDate = searchParams.get("startDate")
            ? new Date(searchParams.get("startDate")!)
            : undefined;
        const endDate = searchParams.get("endDate")
            ? new Date(searchParams.get("endDate")!)
            : undefined;

        // Validate format
        if (!["json", "csv", "pdf"].includes(format)) {
            return NextResponse.json(
                { error: "Invalid format. Must be json, csv, or pdf" },
                { status: 400 }
            );
        }

        // Fetch sessions with filters (dynamic imports)
        const { SessionRepository } = await import("@/lib/services/session-repository");
        const sessionRepo = new SessionRepository();
        const sessions = await sessionRepo.getSessionHistory({
            tenantId,
            status: status as any,
            startDate,
            endDate,
            limit: 1000, // Limit to prevent memory issues
        });

        // Export sessions (dynamic import)
        const { ExportService } = await import("@/lib/services/export-service");
        const exported = await ExportService.exportSessions(sessions, { format });

        // Return file
        return new NextResponse(exported.data as any, {
            headers: {
                "Content-Type": exported.contentType,
                "Content-Disposition": `attachment; filename="${exported.filename}"`,
            },
        });
    } catch (error) {
        console.error("[Export Sessions API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to export sessions",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "importExport", handleGET);
}
