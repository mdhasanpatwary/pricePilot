/**
 * Tests for Query Optimization Utilities
 * 
 * Tests parameterized queries, cursor pagination, and tenant filtering
 */

import {
    ParameterizedQueryHelper,
    CursorPaginationHelper,
    TenantFilterMiddleware,
    QueryOptimizationUtils,
    CursorPaginationOptions,
} from '@/lib/utils/query-optimization';

describe('ParameterizedQueryHelper', () => {
    describe('buildWhereClause', () => {
        it('should build WHERE clause with parameterized values', () => {
            const filters = {
                status: 'active',
                price: 100,
                brand: 'Samsung',
            };

            const { where, params } = ParameterizedQueryHelper.buildWhereClause(filters);

            expect(where).toEqual(filters);
            expect(params).toEqual(['active', 100, 'Samsung']);
        });

        it('should exclude undefined and null values', () => {
            const filters = {
                status: 'active',
                price: undefined,
                brand: null,
            };

            const { where, params } = ParameterizedQueryHelper.buildWhereClause(filters);

            expect(where).toEqual({ status: 'active' });
            expect(params).toEqual(['active']);
        });

        it('should handle empty filters', () => {
            const { where, params } = ParameterizedQueryHelper.buildWhereClause({});

            expect(where).toEqual({});
            expect(params).toEqual([]);
        });
    });

    describe('buildSafeQuery', () => {
        it('should build safe query with filters and options', () => {
            const filters = { status: 'active' };
            const options = {
                orderBy: { createdAt: 'desc' },
                take: 20,
                skip: 10,
            };

            const query = ParameterizedQueryHelper.buildSafeQuery(filters, options);

            expect(query).toEqual({
                where: { status: 'active' },
                orderBy: { createdAt: 'desc' },
                take: 20,
                skip: 10,
            });
        });

        it('should build query without optional parameters', () => {
            const filters = { status: 'active' };
            const query = ParameterizedQueryHelper.buildSafeQuery(filters);

            expect(query).toEqual({
                where: { status: 'active' },
            });
        });
    });

    describe('isParameterized', () => {
        it('should detect SQL injection attempts', () => {
            const maliciousQueries = [
                "SELECT * FROM users WHERE id = '1' OR '1'='1'",
                "SELECT * FROM users; DROP TABLE users;",
                "SELECT * FROM users WHERE id = 1 UNION SELECT * FROM passwords",
                "SELECT * FROM users WHERE id = 1--",
                "SELECT * FROM users WHERE id = 1 /* comment */",
            ];

            maliciousQueries.forEach(query => {
                expect(ParameterizedQueryHelper.isParameterized(query)).toBe(false);
            });
        });

        it('should accept safe parameterized queries', () => {
            const safeQueries = [
                "SELECT * FROM users WHERE id = $1",
                "SELECT * FROM users WHERE status = $1 AND price > $2",
                "INSERT INTO users (name, email) VALUES ($1, $2)",
            ];

            safeQueries.forEach(query => {
                expect(ParameterizedQueryHelper.isParameterized(query)).toBe(true);
            });
        });
    });
});

describe('CursorPaginationHelper', () => {
    describe('shouldUseCursorPagination', () => {
        it('should recommend cursor pagination for large tables', () => {
            expect(CursorPaginationHelper.shouldUseCursorPagination(15000)).toBe(true);
            expect(CursorPaginationHelper.shouldUseCursorPagination(50000)).toBe(true);
        });

        it('should not recommend cursor pagination for small tables', () => {
            expect(CursorPaginationHelper.shouldUseCursorPagination(5000)).toBe(false);
            expect(CursorPaginationHelper.shouldUseCursorPagination(10000)).toBe(false);
        });
    });

    describe('buildCursorQuery', () => {
        it('should build cursor query without cursor (first page)', () => {
            const options: CursorPaginationOptions = {
                take: 20,
                orderBy: { createdAt: 'desc' },
            };

            const query = CursorPaginationHelper.buildCursorQuery(options);

            expect(query).toEqual({
                take: 21, // +1 to check for more
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should build cursor query with cursor (subsequent pages)', () => {
            const options: CursorPaginationOptions = {
                cursor: 'cursor-id-123',
                take: 20,
                orderBy: { createdAt: 'desc' },
            };

            const query = CursorPaginationHelper.buildCursorQuery(options);

            expect(query).toEqual({
                take: 21,
                orderBy: { createdAt: 'desc' },
                cursor: { id: 'cursor-id-123' },
                skip: 1,
            });
        });

        it('should use default orderBy if not provided', () => {
            const options: CursorPaginationOptions = {
                take: 20,
            };

            const query = CursorPaginationHelper.buildCursorQuery(options);

            expect(query.orderBy).toEqual({ id: 'asc' });
        });
    });

    describe('processCursorResults', () => {
        it('should process results with more pages available', () => {
            const results = [
                { id: '1', name: 'Item 1' },
                { id: '2', name: 'Item 2' },
                { id: '3', name: 'Item 3' },
            ];

            const result = CursorPaginationHelper.processCursorResults(results, 2);

            expect(result).toEqual({
                data: [
                    { id: '1', name: 'Item 1' },
                    { id: '2', name: 'Item 2' },
                ],
                nextCursor: '2',
                hasMore: true,
                totalFetched: 2,
            });
        });

        it('should process results with no more pages', () => {
            const results = [
                { id: '1', name: 'Item 1' },
                { id: '2', name: 'Item 2' },
            ];

            const result = CursorPaginationHelper.processCursorResults(results, 2);

            expect(result).toEqual({
                data: results,
                nextCursor: null,
                hasMore: false,
                totalFetched: 2,
            });
        });

        it('should handle empty results', () => {
            const result = CursorPaginationHelper.processCursorResults([], 20);

            expect(result).toEqual({
                data: [],
                nextCursor: null,
                hasMore: false,
                totalFetched: 0,
            });
        });
    });

    describe('paginate', () => {
        it('should execute cursor-based pagination', async () => {
            const mockData = [
                { id: '1', name: 'Item 1' },
                { id: '2', name: 'Item 2' },
                { id: '3', name: 'Item 3' },
            ];

            const queryFn = jest.fn().mockResolvedValue(mockData);

            const result = await CursorPaginationHelper.paginate(queryFn, {
                take: 2,
                orderBy: { createdAt: 'desc' },
            });

            expect(queryFn).toHaveBeenCalledWith({
                take: 3,
                orderBy: { createdAt: 'desc' },
            });

            expect(result).toEqual({
                data: [
                    { id: '1', name: 'Item 1' },
                    { id: '2', name: 'Item 2' },
                ],
                nextCursor: '2',
                hasMore: true,
                totalFetched: 2,
            });
        });
    });
});

describe('TenantFilterMiddleware', () => {
    const tenantId = 'tenant-123';

    describe('buildTenantQuery', () => {
        it('should build query with tenant ID as first filter', () => {
            const query = TenantFilterMiddleware.buildTenantQuery({
                tenantId,
                additionalFilters: { status: 'active' },
            });

            expect(query).toEqual({
                where: {
                    tenantId: 'tenant-123',
                    status: 'active',
                },
            });
        });

        it('should build query with only tenant ID', () => {
            const query = TenantFilterMiddleware.buildTenantQuery({ tenantId });

            expect(query).toEqual({
                where: {
                    tenantId: 'tenant-123',
                },
            });
        });
    });

    describe('validateTenantFilter', () => {
        it('should validate correct tenant filter', () => {
            const where = { tenantId: 'tenant-123', status: 'active' };
            expect(TenantFilterMiddleware.validateTenantFilter(where, 'tenant-123')).toBe(true);
        });

        it('should reject missing tenant filter', () => {
            const where = { status: 'active' };
            expect(TenantFilterMiddleware.validateTenantFilter(where, 'tenant-123')).toBe(false);
        });

        it('should reject wrong tenant ID', () => {
            const where = { tenantId: 'tenant-456', status: 'active' };
            expect(TenantFilterMiddleware.validateTenantFilter(where, 'tenant-123')).toBe(false);
        });

        it('should reject invalid where clause', () => {
            expect(TenantFilterMiddleware.validateTenantFilter(null, 'tenant-123')).toBe(false);
            expect(TenantFilterMiddleware.validateTenantFilter(undefined, 'tenant-123')).toBe(false);
        });
    });

    describe('withTenantFilter', () => {
        it('should wrap query function with tenant filter', async () => {
            const mockQueryFn = jest.fn().mockResolvedValue([{ id: '1' }]);
            const wrappedFn = TenantFilterMiddleware.withTenantFilter(tenantId, mockQueryFn);

            const result = await wrappedFn({ status: 'active' });

            expect(mockQueryFn).toHaveBeenCalledWith({
                tenantId: 'tenant-123',
                status: 'active',
            });
            expect(result).toEqual([{ id: '1' }]);
        });
    });

    describe('createTenantQueryBuilder', () => {
        const builder = TenantFilterMiddleware.createTenantQueryBuilder(tenantId);

        it('should build findMany query', () => {
            const query = builder.findMany({ status: 'active' });
            expect(query).toEqual({
                where: {
                    tenantId: 'tenant-123',
                    status: 'active',
                },
            });
        });

        it('should build findUnique query', () => {
            const query = builder.findUnique('product-123');
            expect(query).toEqual({
                where: {
                    id: 'product-123',
                    tenantId: 'tenant-123',
                },
            });
        });

        it('should build count query', () => {
            const query = builder.count({ status: 'active' });
            expect(query).toEqual({
                where: {
                    tenantId: 'tenant-123',
                    status: 'active',
                },
            });
        });

        it('should build update query', () => {
            const query = builder.update('product-123', { price: 99.99 });
            expect(query).toEqual({
                where: {
                    id: 'product-123',
                    tenantId: 'tenant-123',
                },
                data: { price: 99.99 },
            });
        });

        it('should build delete query', () => {
            const query = builder.delete('product-123');
            expect(query).toEqual({
                where: {
                    id: 'product-123',
                    tenantId: 'tenant-123',
                },
            });
        });
    });
});

describe('QueryOptimizationUtils', () => {
    const tenantId = 'tenant-123';

    describe('buildOptimizedQuery', () => {
        it('should build optimized query with cursor pagination', () => {
            const query = QueryOptimizationUtils.buildOptimizedQuery({
                tenantId,
                filters: { status: 'active' },
                cursor: 'cursor-123',
                take: 20,
                orderBy: { createdAt: 'desc' },
                useCursorPagination: true,
            });

            expect(query).toEqual({
                where: {
                    tenantId: 'tenant-123',
                    status: 'active',
                },
                take: 21,
                orderBy: { createdAt: 'desc' },
                cursor: { id: 'cursor-123' },
                skip: 1,
            });
        });

        it('should build optimized query with offset pagination', () => {
            const query = QueryOptimizationUtils.buildOptimizedQuery({
                tenantId,
                filters: { status: 'active' },
                take: 20,
                orderBy: { createdAt: 'desc' },
                useCursorPagination: false,
            });

            expect(query).toEqual({
                where: {
                    tenantId: 'tenant-123',
                    status: 'active',
                },
                take: 20,
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should use default values', () => {
            const query = QueryOptimizationUtils.buildOptimizedQuery({
                tenantId,
            });

            expect(query).toEqual({
                where: {
                    tenantId: 'tenant-123',
                },
                take: 20,
                orderBy: { createdAt: 'desc' },
            });
        });
    });

    describe('shouldUseCursorPagination', () => {
        it('should recommend cursor pagination for large tables', async () => {
            const countFn = jest.fn().mockResolvedValue(15000);
            const result = await QueryOptimizationUtils.shouldUseCursorPagination(countFn);

            expect(countFn).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should not recommend cursor pagination for small tables', async () => {
            const countFn = jest.fn().mockResolvedValue(5000);
            const result = await QueryOptimizationUtils.shouldUseCursorPagination(countFn);

            expect(countFn).toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });
});
