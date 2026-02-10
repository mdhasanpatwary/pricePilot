import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * Manual Price Entry API
 *
 * Allows users to manually enter competitor prices when automated scraping fails.
 * Validates price input, stores user and timestamp, and marks price as manual.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

const manualPriceSchema = z.object({
    price: z.number()
        .positive('Price must be greater than zero')
        .max(1000000, 'Price must be less than $1,000,000')
        .refine((val) => {
            // Ensure price has at most 2 decimal places
            return Number.isInteger(val * 100);
        }, 'Price must have at most 2 decimal places'),
    currency: z.string().optional().default('USD'),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authenticate user
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    },
                },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const tenantId = session.user.tenantId;
        const { id: productId } = await params;

        // Parse and validate request body
        const body = await request.json();
        const validation = manualPriceSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid price input',
                        details: {
                            fields: validation.error.flatten().fieldErrors,
                        },
                    },
                },
                { status: 422 }
            );
        }

        const { price, currency } = validation.data;

        // Verify product exists and belongs to tenant
        const product = await prisma.product.findFirst({
            where: {
                id: productId,
                tenantId: tenantId,
            },
            include: {
                Site: true,
            },
        });

        if (!product) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Competitor product not found',
                    },
                },
                { status: 404 }
            );
        }

        // Verify this is a competitor product
        if (product.Site.type !== 'COMPETITOR') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_PRODUCT_TYPE',
                        message: 'Manual price entry is only allowed for competitor products',
                    },
                },
                { status: 400 }
            );
        }

        // Store the old price for history
        const oldPrice = product.currentPrice;

        // Update product with manual price
        const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: {
                manualPrice: price,
                manualPriceEnteredBy: userId,
                manualPriceEnteredAt: new Date(),
                isManualPrice: true,
                currentPrice: price, // Update current price to manual price
                currency: currency,
                updatedAt: new Date(),
            },
        });

        // Create price history entry
        await prisma.priceHistory.create({
            data: {
                productId: productId,
                price: price,
                recordedAt: new Date(),
            },
        });

        // Create audit log
        await prisma.tenantAuditLog.create({
            data: {
                tenantId: tenantId,
                userId: userId,
                userEmail: session.user.email || '',
                action: 'MANUAL_PRICE_ENTRY',
                entityId: productId,
                details: JSON.stringify({
                    oldPrice: oldPrice.toString(),
                    newPrice: price.toString(),
                    currency: currency,
                    productTitle: product.title,
                }),
                ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                productId: updatedProduct.id,
                price: updatedProduct.manualPrice,
                currency: updatedProduct.currency,
                enteredBy: updatedProduct.manualPriceEnteredBy,
                enteredAt: updatedProduct.manualPriceEnteredAt,
                isManualPrice: updatedProduct.isManualPrice,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Manual price entry error:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to save manual price',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}
