/**
 * Pagination Utility
 * 
 * Provides helper functions for paginating database queries
 * with consistent response format across all API endpoints.
 */

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

/**
 * Paginate a Prisma query with consistent response format
 * 
 * @param model - Prisma model to query
 * @param where - Where clause for filtering
 * @param params - Pagination parameters
 * @param include - Relations to include
 * @returns Paginated response with data and pagination metadata
 * 
 * @example
 * ```typescript
 * const result = await paginate(
 *   prisma.product,
 *   { tenantId: 'abc123' },
 *   { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
 *   { site: true, matchesAsUser: true }
 * );
 * ```
 */
export async function paginate<T>(
    model: any,
    where: any,
    params: PaginationParams,
    include?: any
): Promise<PaginatedResponse<T>> {
    // Validate and normalize pagination parameters
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    // Execute query and count in parallel for performance
    const [data, total] = await Promise.all([
        model.findMany({
            where,
            include,
            skip,
            take: limit,
            orderBy: params.sortBy ? {
                [params.sortBy]: params.sortOrder || 'desc'
            } : undefined
        }),
        model.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}

/**
 * Extract pagination parameters from URL search params
 * 
 * @param searchParams - URL search params
 * @returns Normalized pagination parameters
 * 
 * @example
 * ```typescript
 * const params = getPaginationParams(req.nextUrl.searchParams);
 * ```
 */
export function getPaginationParams(searchParams: URLSearchParams): PaginationParams {
    return {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
        sortBy: searchParams.get('sortBy') || undefined,
        sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined
    };
}
