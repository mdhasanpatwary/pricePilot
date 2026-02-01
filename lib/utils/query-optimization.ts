/**
 * Query Optimization Utilities
 *
 * Provides utilities for optimized database queries including:
 * - Parameterized query helpers
 * - Cursor-based pagination for large tables
 * - Tenant ID filtering middleware
 *
 * Requirements: 5.1, 5.2, 5.4
 */



/**
 * Parameterized Query Helper
 *
 * Ensures all queries use parameterized statements to:
 * - Prevent SQL injection
 * - Enable query plan caching
 * - Improve performance
 *
 * Validates: Requirement 5.1
 */
export class ParameterizedQueryHelper {
    /**
     * Build a safe WHERE clause with parameterized values
     */
    static buildWhereClause<T extends Record<string, any>>(
        filters: T
    ): { where: any; params: any[] } {
        const where: any = {};
        const params: any[] = [];

        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                where[key] = value;
                params.push(value);
            }
        }

        return { where, params };
    }

    /**
     * Build a safe parameterized query for Prisma
     */
    static buildSafeQuery<T extends Record<string, any>>(
        filters: T,
        options?: {
            orderBy?: any;
            take?: number;
            skip?: number;
        }
    ): any {
        const { where } = this.buildWhereClause(filters);

        return {
            where,
            ...(options?.orderBy && { orderBy: options.orderBy }),
            ...(options?.take && { take: options.take }),
            ...(options?.skip && { skip: options.skip }),
        };
    }

    /**
     * Validate that a query uses parameterized values
     */
    static isParameterized(query: string): boolean {
        // Check for common SQL injection patterns
        const dangerousPatterns = [
            /'\s*OR\s*'1'\s*=\s*'1/i,
            /;\s*DROP\s+TABLE/i,
            /;\s*DELETE\s+FROM/i,
            /UNION\s+SELECT/i,
            /--\s*$/,
            /\/\*.*\*\//,
        ];

        return !dangerousPatterns.some(pattern => pattern.test(query));
    }
}

/**
 * Cursor-Based Pagination Helper
 *
 * Implements efficient cursor-based pagination for large tables (>10,000 rows)
 * instead of offset-based pagination which becomes slow on large datasets.
 *
 * Validates: Requirement 5.2
 */
export interface CursorPaginationOptions {
    cursor?: string; // ID of the last item from previous page
    take: number; // Number of items to fetch
    orderBy?: any; // Order by clause
}

export interface CursorPaginationResult<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
    totalFetched: number;
}

export class CursorPaginationHelper {
    private static readonly LARGE_TABLE_THRESHOLD = 10000;

    /**
     * Check if a table should use cursor-based pagination
     */
    static shouldUseCursorPagination(estimatedRowCount: number): boolean {
        return estimatedRowCount > this.LARGE_TABLE_THRESHOLD;
    }

    /**
     * Build cursor-based pagination query
     */
    static buildCursorQuery(
        options: CursorPaginationOptions
    ): any {
        const { cursor, take, orderBy } = options;

        const query: any = {
            take: take + 1, // Fetch one extra to determine if there are more
            orderBy: orderBy || { id: 'asc' },
        };

        if (cursor) {
            query.cursor = { id: cursor };
            query.skip = 1; // Skip the cursor itself
        }

        return query;
    }

    /**
     * Process cursor pagination results
     */
    static processCursorResults<T extends { id: string }>(
        results: T[],
        take: number
    ): CursorPaginationResult<T> {
        const hasMore = results.length > take;
        const data = hasMore ? results.slice(0, take) : results;
        const nextCursor = hasMore && data.length > 0
            ? data[data.length - 1].id
            : null;

        return {
            data,
            nextCursor,
            hasMore,
            totalFetched: data.length,
        };
    }

    /**
     * Execute cursor-based pagination query
     */
    static async paginate<T extends { id: string }>(
        queryFn: (query: any) => Promise<T[]>,
        options: CursorPaginationOptions
    ): Promise<CursorPaginationResult<T>> {
        const query = this.buildCursorQuery(options);
        const results = await queryFn(query);
        return this.processCursorResults(results, options.take);
    }
}

/**
 * Tenant ID Filtering Middleware
 *
 * Ensures all multi-tenant queries include tenantId in the WHERE clause
 * as the first filter to enforce tenant isolation.
 *
 * Validates: Requirement 5.4
 */
export interface TenantFilterOptions {
    tenantId: string;
    additionalFilters?: Record<string, any>;
}

export class TenantFilterMiddleware {
    /**
     * Build a query with tenant ID as the first filter
     */
    static buildTenantQuery(options: TenantFilterOptions): any {
        const { tenantId, additionalFilters = {} } = options;

        // Ensure tenantId is always the first filter
        return {
            where: {
                tenantId,
                ...additionalFilters,
            },
        };
    }

    /**
     * Validate that a query includes tenant ID filter
     */
    static validateTenantFilter(where: any, requiredTenantId: string): boolean {
        if (!where || typeof where !== 'object') {
            return false;
        }

        // Check if tenantId is present and matches
        return where.tenantId === requiredTenantId;
    }

    /**
     * Wrap a query function to automatically inject tenant ID
     */
    static withTenantFilter<T>(
        tenantId: string,
        queryFn: (where: any) => Promise<T>
    ): (additionalFilters?: Record<string, any>) => Promise<T> {
        return async (additionalFilters?: Record<string, any>) => {
            const query = this.buildTenantQuery({ tenantId, additionalFilters });
            return queryFn(query.where);
        };
    }

    /**
     * Create a tenant-scoped query builder
     */
    static createTenantQueryBuilder(tenantId: string) {
        return {
            /**
             * Build a find query with tenant filter
             */
            findMany: (additionalFilters?: Record<string, any>) => {
                return this.buildTenantQuery({ tenantId, additionalFilters });
            },

            /**
             * Build a find unique query with tenant filter
             */
            findUnique: (id: string) => {
                return {
                    where: {
                        id,
                        tenantId,
                    },
                };
            },

            /**
             * Build a count query with tenant filter
             */
            count: (additionalFilters?: Record<string, any>) => {
                return this.buildTenantQuery({ tenantId, additionalFilters });
            },

            /**
             * Build an update query with tenant filter
             */
            update: (id: string, data: any) => {
                return {
                    where: {
                        id,
                        tenantId,
                    },
                    data,
                };
            },

            /**
             * Build a delete query with tenant filter
             */
            delete: (id: string) => {
                return {
                    where: {
                        id,
                        tenantId,
                    },
                };
            },
        };
    }
}

/**
 * Query Optimization Utilities
 *
 * Collection of utility functions for query optimization
 */
export class QueryOptimizationUtils {
    /**
     * Build an optimized query with all best practices
     */
    static buildOptimizedQuery(options: {
        tenantId: string;
        filters?: Record<string, any>;
        cursor?: string;
        take?: number;
        orderBy?: any;
        useCursorPagination?: boolean;
    }): any {
        const {
            tenantId,
            filters = {},
            cursor,
            take = 20,
            orderBy,
            useCursorPagination = false,
        } = options;

        // Start with tenant filter
        const baseQuery = TenantFilterMiddleware.buildTenantQuery({
            tenantId,
            additionalFilters: filters,
        });

        // Add pagination
        if (useCursorPagination && cursor) {
            const paginationQuery = CursorPaginationHelper.buildCursorQuery({
                cursor,
                take,
                orderBy,
            });

            return {
                ...baseQuery,
                ...paginationQuery,
            };
        }

        // Use offset pagination for small datasets
        return {
            ...baseQuery,
            take,
            orderBy: orderBy || { createdAt: 'desc' },
        };
    }

    /**
     * Estimate if cursor pagination should be used
     */
    static async shouldUseCursorPagination(
        countFn: () => Promise<number>
    ): Promise<boolean> {
        const count = await countFn();
        return CursorPaginationHelper.shouldUseCursorPagination(count);
    }
}

/**
 * Export all utilities
 */

