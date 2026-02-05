'use client';

/**
 * Competitor Product Card Component
 * 
 * Displays competitor product information with:
 * - Protection status indicators
 * - Error messages when scraping fails
 * - Last known good prices with age indicators
 * - Manual price entry option
 * 
 * Requirements: 10.1, 10.4, 13.1, 14.2
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Shield,
    TrendingDown,
    TrendingUp,
    Edit,
    ExternalLink,
} from 'lucide-react';
import { ManualPriceEntryModal } from './manual-price-entry-modal';
import { LastKnownGoodIndicator } from './last-known-good-indicator';
import { ManualPriceIndicator } from './manual-price-indicator';
import { formatDistanceToNow } from 'date-fns';

export interface CompetitorProductData {
    id: string;
    title: string;
    url: string;
    currentPrice: number | null;
    currency: string;
    lastCrawledAt: Date | null;
    inStock: boolean;

    // Protection status
    protectionDetected?: boolean;
    protectionType?: string;
    lastProtectionDetectedAt?: Date | null;

    // Last known good price
    lastKnownGoodPrice?: number | null;
    lastKnownGoodPriceAt?: Date | null;
    lastKnownGoodCurrency?: string;

    // Manual price
    isManualPrice?: boolean;
    manualPrice?: number | null;
    manualPriceEnteredBy?: string | null;
    manualPriceEnteredAt?: Date | null;

    // Site info
    competitorWebsite?: {
        id: string;
        baseUrl: string;
        name?: string;
    };
}

interface CompetitorProductCardProps {
    product: CompetitorProductData;
    onPriceUpdate?: () => void;
}

export function CompetitorProductCard({
    product,
    onPriceUpdate,
}: CompetitorProductCardProps) {
    const [showManualEntry, setShowManualEntry] = useState(false);

    // Determine if scraping is failing
    const isScrapingFailed = !product.currentPrice && !product.isManualPrice;
    const hasProtection = product.protectionDetected;

    // Calculate price age
    const priceAge = product.lastCrawledAt
        ? formatDistanceToNow(new Date(product.lastCrawledAt), { addSuffix: true })
        : 'Never';

    // Get protection status message
    const getProtectionMessage = () => {
        if (!hasProtection || !product.protectionType) {
            return null;
        }

        const messages: Record<string, string> = {
            ip_block: 'Site is blocking our IP addresses. Prices will be retried with different proxies.',
            rate_limit: 'Site is rate limiting our requests. Scraping will resume after cooldown period.',
            captcha: 'Site requires CAPTCHA verification. Manual intervention may be required.',
            fake_data: 'Site is serving fake data. Using headless browser to bypass protection.',
            redirect_block: 'Site is redirecting to error pages. Adjusting scraping strategy.',
            delayed_response: 'Site is delaying responses. Increasing timeout thresholds.',
            empty_response: 'Site is returning empty responses. Investigating issue.',
            javascript_challenge: 'Site requires JavaScript execution. Using headless browser.',
            unknown: 'Unknown protection detected. Analyzing response patterns.',
        };

        return messages[product.protectionType] || messages.unknown;
    };

    const protectionMessage = getProtectionMessage();

    return (
        <>
            <Card className="w-full">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <CardTitle className="text-lg font-semibold line-clamp-2">
                                {product.title}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                                <a
                                    href={product.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    {product.competitorWebsite?.baseUrl || 'View Product'}
                                </a>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex flex-col items-end gap-2">
                            {hasProtection ? (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    Protected
                                </Badge>
                            ) : isScrapingFailed ? (
                                <Badge variant="outline" className="flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Failed
                                </Badge>
                            ) : (
                                <Badge variant="default" className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Active
                                </Badge>
                            )}

                            {!product.inStock && (
                                <Badge variant="secondary">Out of Stock</Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Protection Alert */}
                    {hasProtection && protectionMessage && (
                        <Alert variant="destructive">
                            <Shield className="h-4 w-4" />
                            <AlertDescription>{protectionMessage}</AlertDescription>
                        </Alert>
                    )}

                    {/* Price Display */}
                    <div className="space-y-2">
                        {product.isManualPrice && product.manualPrice ? (
                            <div className="space-y-2">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold">
                                        {product.currency} {product.manualPrice.toFixed(2)}
                                    </span>
                                </div>
                                <ManualPriceIndicator
                                    enteredBy={product.manualPriceEnteredBy || undefined}
                                    enteredAt={product.manualPriceEnteredAt || undefined}
                                    variant="detailed"
                                />
                            </div>
                        ) : product.currentPrice ? (
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">
                                    {product.currency} {product.currentPrice.toFixed(2)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    Updated {priceAge}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <AlertCircle className="h-5 w-5" />
                                <span>No current price available</span>
                            </div>
                        )}

                        {/* Last Known Good Price */}
                        {!product.currentPrice &&
                            !product.isManualPrice &&
                            product.lastKnownGoodPrice &&
                            product.lastKnownGoodPriceAt && (
                                <div className="space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-semibold text-muted-foreground">
                                            {product.lastKnownGoodCurrency || product.currency}{' '}
                                            {product.lastKnownGoodPrice.toFixed(2)}
                                        </span>
                                    </div>
                                    <LastKnownGoodIndicator
                                        priceTimestamp={new Date(product.lastKnownGoodPriceAt)}
                                    />
                                </div>
                            )}
                    </div>

                    {/* Last Crawled Info */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Last scraped: {priceAge}</span>
                    </div>

                    {/* Actions */}
                    {isScrapingFailed && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowManualEntry(true)}
                                className="flex items-center gap-2"
                            >
                                <Edit className="h-4 w-4" />
                                Enter Price Manually
                            </Button>
                        </div>
                    )}

                    {/* Price Trend Indicator (if we have history) */}
                    {product.lastKnownGoodPrice && product.currentPrice && (
                        <div className="flex items-center gap-2 text-sm">
                            {product.currentPrice > product.lastKnownGoodPrice ? (
                                <>
                                    <TrendingUp className="h-4 w-4 text-red-500" />
                                    <span className="text-red-500">
                                        +{((product.currentPrice - product.lastKnownGoodPrice) / product.lastKnownGoodPrice * 100).toFixed(1)}%
                                    </span>
                                </>
                            ) : product.currentPrice < product.lastKnownGoodPrice ? (
                                <>
                                    <TrendingDown className="h-4 w-4 text-green-500" />
                                    <span className="text-green-500">
                                        {((product.currentPrice - product.lastKnownGoodPrice) / product.lastKnownGoodPrice * 100).toFixed(1)}%
                                    </span>
                                </>
                            ) : null}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Manual Price Entry Modal */}
            <ManualPriceEntryModal
                open={showManualEntry}
                onOpenChange={setShowManualEntry}
                productId={product.id}
                productTitle={product.title}
                competitorSiteName={product.competitorWebsite?.baseUrl || 'Competitor'}
                currency={product.currency}
                onSuccess={() => {
                    setShowManualEntry(false);
                    onPriceUpdate?.();
                }}
            />
        </>
    );
}
