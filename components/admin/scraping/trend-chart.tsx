"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock } from "lucide-react";

export type TimeRange = '24h' | '7d' | '30d';

interface TrendDataPoint {
    timestamp: string;
    successRate: number;
    avgResponseTime: number;
    totalAttempts: number;
    protectionDetections: number;
}

interface TrendChartProps {
    data: TrendDataPoint[];
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
    title?: string;
    description?: string;
}

const CustomTooltip = ({ active, payload, label, timeRange }: any) => {
    if (active && payload && payload.length) {
        const formatTimestamp = (timestamp: string) => {
            const date = new Date(timestamp);
            if (timeRange === '24h') {
                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            } else if (timeRange === '7d') {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        };

        return (
            <div className="bg-background border rounded-lg p-3 shadow-lg">
                <p className="text-sm font-medium mb-2">{formatTimestamp(label)}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {entry.value.toFixed(entry.name.includes('Rate') ? 1 : 0)}
                        {entry.name.includes('Rate') ? '%' : entry.name.includes('Time') ? 'ms' : ''}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export function TrendChart({
    data,
    timeRange,
    onTimeRangeChange,
    title = "Success Rate Trends",
    description = "Historical success rate over time"
}: TrendChartProps) {
    const [activeChart, setActiveChart] = useState<'successRate' | 'responseTime' | 'protections'>('successRate');

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        if (timeRange === '24h') {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (timeRange === '7d') {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            {title}
                        </CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1 border rounded-lg p-1">
                            <Button
                                variant={timeRange === '24h' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => onTimeRangeChange('24h')}
                            >
                                24h
                            </Button>
                            <Button
                                variant={timeRange === '7d' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => onTimeRangeChange('7d')}
                            >
                                7d
                            </Button>
                            <Button
                                variant={timeRange === '30d' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => onTimeRangeChange('30d')}
                            >
                                30d
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Chart Type Selector */}
                <div className="flex gap-2 mb-4">
                    <Button
                        variant={activeChart === 'successRate' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveChart('successRate')}
                    >
                        Success Rate
                    </Button>
                    <Button
                        variant={activeChart === 'responseTime' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveChart('responseTime')}
                    >
                        Response Time
                    </Button>
                    <Button
                        variant={activeChart === 'protections' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveChart('protections')}
                    >
                        Protection Detections
                    </Button>
                </div>

                {/* Chart */}
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        {activeChart === 'successRate' ? (
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorSuccessRate" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={formatTimestamp}
                                    className="text-xs"
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    className="text-xs"
                                    label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip content={<CustomTooltip timeRange={timeRange} />} />
                                <Area
                                    type="monotone"
                                    dataKey="successRate"
                                    stroke="hsl(var(--primary))"
                                    fill="url(#colorSuccessRate)"
                                    name="Success Rate"
                                />
                            </AreaChart>
                        ) : activeChart === 'responseTime' ? (
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={formatTimestamp}
                                    className="text-xs"
                                />
                                <YAxis
                                    className="text-xs"
                                    label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip content={<CustomTooltip timeRange={timeRange} />} />
                                <Line
                                    type="monotone"
                                    dataKey="avgResponseTime"
                                    stroke="hsl(var(--chart-2))"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Avg Response Time"
                                />
                            </LineChart>
                        ) : (
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorProtections" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={formatTimestamp}
                                    className="text-xs"
                                />
                                <YAxis
                                    className="text-xs"
                                    label={{ value: 'Detections', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip content={<CustomTooltip timeRange={timeRange} />} />
                                <Area
                                    type="monotone"
                                    dataKey="protectionDetections"
                                    stroke="hsl(var(--destructive))"
                                    fill="url(#colorProtections)"
                                    name="Protection Detections"
                                />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <Clock className="h-12 w-12 mb-2 opacity-50" />
                        <p className="text-sm">No trend data available for this time range</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Protection type breakdown chart
 */
interface ProtectionTypeChartProps {
    data: Record<string, number>;
}

export function ProtectionTypeChart({ data }: ProtectionTypeChartProps) {
    const chartData = Object.entries(data).map(([type, count]) => ({
        name: type.replace(/_/g, ' '),
        value: count
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Protection Type Trends</CardTitle>
                <CardDescription>Distribution of detected protection mechanisms</CardDescription>
            </CardHeader>
            <CardContent>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="hsl(var(--chart-3))"
                                fill="hsl(var(--chart-3))"
                                fillOpacity={0.3}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                        <p className="text-sm">No protection type data available</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
