import { prisma } from "@/lib/prisma";

/**
 * Audit Log Actions
 */
export type AuditAction =
  | "APPROVE_MATCH"
  | "REJECT_MATCH"
  | "CREATE_PRICING_RULE"
  | "UPDATE_PRICING_RULE"
  | "DELETE_PRICING_RULE"
  | "CREATE_INTEGRATION"
  | "UPDATE_INTEGRATION"
  | "DELETE_INTEGRATION"
  | "CREATE_COMPETITOR"
  | "DELETE_COMPETITOR"
  | "EXPORT_PRODUCTS"
  | "EXPORT_COMPETITORS"
  | "IMPORT_PRODUCTS"
  | "IMPORT_COMPETITORS"
  | "BULK_PRICE_UPDATE"
  | "UPDATE_TENANT"
  | "CREATE_TENANT"
  | "DELETE_TENANT"
  | "UPDATE_SYSTEM_CONFIG"
  | "USER_REGISTRATION"
  | "CHANGE_PASSWORD"
  | "PASSWORD_RESET_REQUESTED";

interface AuditLogOptions {
  tenantId: string;
  userId: string;
  userEmail: string;
  action: AuditAction | string;
  entityId: string;
  details?: any;
  ipAddress?: string;
}

/**
 * Records an audit log entry in the database.
 * This is designed to fail silently (it logs to console) to prevent
 * audit logging failures from breaking the primary application logic.
 */
export async function recordAuditLog(options: AuditLogOptions) {
  try {
    await prisma.tenantAuditLog.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        userEmail: options.userEmail,
        action: options.action,
        entityId: options.entityId,
        details: options.details ? JSON.stringify(options.details) : null,
        ipAddress: options.ipAddress || null,
      },
    });
  } catch (error) {
    console.error(
      `[AuditLog] CRITICAL: Failed to record audit log for action: ${options.action}`,
      error,
    );
  }
}

/**
 * Helper to get IP address from NextRequest
 */
export function getIpAddress(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return undefined;
}
