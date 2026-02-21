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
    queryOptions?: any
): Promise<PaginatedResponse<T>> {
    // Validate and normalize pagination parameters
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const normalizedQueryOptions =
        queryOptions && (queryOptions.include || queryOptions.select)
            ? queryOptions
            : queryOptions
                ? { include: queryOptions }
                : {};

    // Execute query and count in parallel for performance
    const [data, total] = await Promise.all([
        model.findMany({
            where,
            ...normalizedQueryOptions,
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

export interface CursorPaginationParams {
    cursor?: string;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface CursorPaginatedResponse<T> {
    data: T[];
    pagination: {
        nextCursor: string | null;
        limit: number;
        total: number;
        hasNext: boolean;
    };
}

/**
 * Paginate a Prisma query using cursor-based pagination
 */
export async function paginateCursor<T>(
    model: any,
    where: any,
    params: CursorPaginationParams,
    queryOptions?: any
): Promise<CursorPaginatedResponse<T>> {
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const sortBy = params.sortBy || 'id';
    const sortOrder = params.sortOrder || 'desc';

    const normalizedQueryOptions =
        queryOptions && (queryOptions.include || queryOptions.select)
            ? queryOptions
            : queryOptions
                ? { include: queryOptions }
                : {};

    const data = await model.findMany({
        where,
        ...normalizedQueryOptions,
        take: limit + 1, // Fetch one extra to determine if there's a next page
        cursor: params.cursor ? { [sortBy]: params.cursor } : undefined,
        skip: params.cursor ? 1 : 0, // Skip the cursor itself
        orderBy: {
            [sortBy]: sortOrder
        }
    });

    const hasNext = data.length > limit;
    const paginatedData = hasNext ? data.slice(0, limit) : data;
    const nextCursor = hasNext ? (paginatedData[paginatedData.length - 1] as any)[sortBy] : null;

    return {
        data: paginatedData,
        pagination: {
            nextCursor,
            limit,
            total: -1, // Count omitted for performance; use hasNext for pagination
            hasNext
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

export function getCursorPaginationParams(searchParams: URLSearchParams): CursorPaginationParams {
    return {
        cursor: searchParams.get('cursor') || undefined,
        limit: parseInt(searchParams.get('limit') || '20'),
        sortBy: searchParams.get('sortBy') || undefined,
        sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined
    };
}
