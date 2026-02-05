/**
 * Price History Chart Component
 * 
 * Displays price history with visual indicators for gaps in data collection.
 * 
 * Requirements: 14.6
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface PriceHistoryPoint {
    id: string;
    price: number;
    recordedAt: Date;
    hasGapBefore: boolean;
    gapDuration?: number;
}

interface PriceHistorySummary {
    totalRecords: number;
    gapCount: number;
    totalGapDays: number;
    averageGapDays: number;
    dataCompleteness: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
}

interface PriceHistoryChartProps {
    productId: string;
    days?: number;
}

export function PriceHistoryChart({ productId, days = 30 }: PriceHistoryChartProps) {
    const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
    const [summary, setSummary] = useState<PriceHistorySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId, days]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `/api/v1/competitor-products/${productId}/price-history?days=${days}&includeSummary=true`
            );
            const data = await response.json();

            if (data.success) {
                setHistory(data.data.history);
                setSummary(data.data.summary);
            } else {
                setError(data.error?.message || 'Failed to load price history');
            }
        } catch (err) {
            setError('Failed to load price history');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Price History</CardTitle>
                    <CardDescription>Historical price trends with gap indicators</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Price History</CardTitle>
                    <CardDescription>Historical price trends with gap indicators</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (history.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Price History</CardTitle>
                    <CardDescription>Historical price trends with gap indicators</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No price history available</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Prepare chart data
    const chartData = history.map((point) => ({
        date: new Date(point.recordedAt).toLocaleDateString(),
        price: point.price,
        hasGap: point.hasGapBefore,
        gapDuration: point.gapDuration,
    }));

    // Calculate price trend
    const firstPrice = history[0].price;
    const lastPrice = history[history.length - 1].price;
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Price History</CardTitle>
                <CardDescription>
                    Last {days} days • {history.length} data points
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary Statistics */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Data Completeness</p>
                            <p className="text-lg font-bold">
                                {summary.dataCompleteness.toFixed(1)}%
                            </p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Gaps Detected</p>
                            <p className="text-lg font-bold">{summary.gapCount}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Price Trend</p>
                            <p
                                className={`text-lg font-bold flex items-center gap-1 ${priceChange > 0 ? 'text-danger' : 'text-success'
                                    }`}
                            >
                                {priceChange > 0 ? (
                                    <TrendingUp className="w-4 h-4" />
                                ) : (
                                    <TrendingDown className="w-4 h-4" />
                                )}
                                {priceChangePercent.toFixed(1)}%
                            </p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Current Price</p>
                            <p className="text-lg font-bold">{formatCurrency(lastPrice, 'USD')}</p>
                        </div>
                    </div>
                )}

                {/* Gap Warning */}
                {summary && summary.gapCount > 0 && (
                    <Alert className="bg-warning/10 text-warning border-warning/20">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            {summary.gapCount} gap{summary.gapCount > 1 ? 's' : ''} detected in
                            price history ({summary.totalGapDays} total days). This indicates
                            periods when scraping failed.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Chart */}
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                                <p className="text-xs text-muted-foreground">
                                                    {data.date}
                                                </p>
                                                <p className="text-sm font-bold">
                                                    {formatCurrency(data.price, 'USD')}
                                                </p>
                                                {data.hasGap && (
                                                    <p className="text-xs text-warning mt-1">
                                                        ⚠️ Gap: {data.gapDuration} days
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                dot={(props: any) => {
                                    const { cx, cy, payload } = props;
                                    return (
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={payload.hasGap ? 5 : 3}
                                            fill={
                                                payload.hasGap
                                                    ? 'hsl(var(--warning))'
                                                    : 'hsl(var(--primary))'
                                            }
                                            stroke="white"
                                            strokeWidth={1}
                                        />
                                    );
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <span className="text-muted-foreground">Normal data point</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-warning" />
                        <span className="text-muted-foreground">Gap detected</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
