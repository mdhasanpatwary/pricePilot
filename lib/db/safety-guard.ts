/**
 * Database Safety Guard
 * 
 * Prevents accidental deletion of critical user data.
 * This middleware intercepts dangerous database operations.
 */

const PROTECTED_TABLES = [
    'users',
    'tenants',
    'user_websites',
    'user_products',
    'price_updates',
    'audit_logs'
] as const;

type ProtectedTable = typeof PROTECTED_TABLES[number];

/**
 * Validates if a database operation is safe to execute
 */
export class DatabaseSafetyGuard {
    /**
     * Check if operation is attempting to delete from protected tables
     */
    static validateOperation(operation: string, table?: string): void {
        const isDeleteOperation = /delete/i.test(operation);

        if (isDeleteOperation && table && this.isProtectedTable(table)) {
            throw new Error(
                `FORBIDDEN: Cannot delete from protected table '${table}'. ` +
                `Use soft delete (status update) instead.`
            );
        }
    }

    /**
     * Check if table is protected
     */
    static isProtectedTable(table: string): boolean {
        return PROTECTED_TABLES.includes(table as ProtectedTable);
    }

    /**
     * Validate SQL query for dangerous operations
     */
    static validateQuery(query: string): void {
        const dangerousPatterns = [
            /DELETE\s+FROM\s+(users|tenants|user_websites|user_products)/i,
            /TRUNCATE\s+(users|tenants|user_websites|user_products)/i,
            /DROP\s+TABLE\s+(users|tenants|user_websites|user_products)/i,
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(query)) {
                throw new Error(
                    `FORBIDDEN: Query contains dangerous operation on protected table. ` +
                    `Query: ${query.substring(0, 100)}...`
                );
            }
        }
    }

    /**
     * Soft delete helper - use this instead of hard delete
     */
    static async softDelete<T extends { status?: string; deletedAt?: Date }>(
        model: any,
        where: any
    ): Promise<T> {
        return model.update({
            where,
            data: {
                status: 'DELETED',
                deletedAt: new Date(),
            },
        });
    }
}

/**
 * Prisma middleware to intercept dangerous operations
 */
export function createSafetyMiddleware() {
    return async (params: any, next: any) => {
        const { model, action } = params;

        // Block hard deletes on protected tables
        if (action === 'delete' || action === 'deleteMany') {
            if (model && DatabaseSafetyGuard.isProtectedTable(model.toLowerCase())) {
                throw new Error(
                    `FORBIDDEN: Hard delete blocked on protected table '${model}'. ` +
                    `Use DatabaseSafetyGuard.softDelete() instead.`
                );
            }
        }

        return next(params);
    };
}

/**
 * Example usage:
 * 
 * // In your Prisma client setup:
 * import { createSafetyMiddleware } from '@/lib/db/safety-guard';
 * 
 * prisma.$use(createSafetyMiddleware());
 * 
 * // For soft deletes:
 * import { DatabaseSafetyGuard } from '@/lib/db/safety-guard';
 * 
 * await DatabaseSafetyGuard.softDelete(prisma.user, { id: userId });
 */
