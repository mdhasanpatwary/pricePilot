/**
 * Alert Testing Page
 *
 * Allows administrators to test alert delivery and view delivery statistics.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 *
 * Features:
 * - Send test alerts to configured channels
 * - View delivery statistics
 * - View recent delivery failures
 * - Filter statistics by channel and time range
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface NotificationChannel {
    id: string;
    type: string;
    name: string;
    enabled: boolean;
}

interface DeliveryResult {
    channel: string;
    success: boolean;
    error?: string;
    deliveredAt?: string;
}

interface DeliveryStats {
    timeRange: string;
    overall: {
        totalAlerts: number;
        totalNotifications: number;
        successfulNotifications: number;
        failedNotifications: number;
        successRate: number;
    };
    byChannel: Record<string, {
        sent: number;
        delivered: number;
        failed: number;
        successRate: number;
    }>;
    recentFailures: Array<{
        alertId: string;
        ruleName: string;
        severity: string;
        triggeredAt: string;
        channel: string;
        error: string;
    }>;
}

export default function AlertTestingPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [channels, setChannels] = useState<NotificationChannel[]>([]);
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [severity, setSeverity] = useState<'CRITICAL' | 'WARNING' | 'INFO'>('INFO');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        deliveryResults: DeliveryResult[];
        statistics: {
            totalChannels: number;
            successCount: number;
            failureCount: number;
            successRate: number;
        };
    } | null>(null);

    const [stats, setStats] = useState<DeliveryStats | null>(null);
    const [timeRange, setTimeRange] = useState('24h');
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // Check authentication and authorization
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/login');
        } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN' && !session?.user?.isSuperAdmin) {
            router.push('/dashboard');
        }
    }, [status, session, router]);

    // Fetch notification channels
    const fetchChannels = useCallback(async () => {
        try {
            const response = await fetch('/api/v1/monitoring/channels');
            const data = await response.json();

            if (data.success) {
                setChannels(data.data.channels);
                // Select all enabled channels by default
                setSelectedChannels(
                    data.data.channels
                        .filter((c: NotificationChannel) => c.enabled)
                        .map((c: NotificationChannel) => c.id)
                );
            }
        } catch (error) {
            console.error('Failed to fetch channels:', error);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        setIsLoadingStats(true);
        try {
            const response = await fetch(`/api/v1/monitoring/delivery-stats?timeRange=${timeRange}`);
            const data = await response.json();

            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch delivery stats:', error);
        } finally {
            setIsLoadingStats(false);
        }
    }, [timeRange]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchChannels();
            fetchStats();
        }
    }, [status, fetchChannels, fetchStats]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchStats();
        }
    }, [timeRange, status, fetchStats]);

    const handleSendTestAlert = async () => {
        if (selectedChannels.length === 0) {
            alert('Please select at least one channel');
            return;
        }

        setIsSending(true);
        setTestResult(null);

        try {
            const response = await fetch('/api/v1/monitoring/test-alert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    channels: selectedChannels,
                    severity,
                    message: message || undefined,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setTestResult({
                    success: true,
                    deliveryResults: data.data.deliveryResults,
                    statistics: data.data.statistics,
                });
                // Refresh stats after sending test
                fetchStats();
            } else {
                alert(`Failed to send test alert: ${data.error.message}`);
            }
        } catch (error) {
            console.error('Failed to send test alert:', error);
            alert('Failed to send test alert');
        } finally {
            setIsSending(false);
        }
    };

    const handleChannelToggle = (channelId: string) => {
        setSelectedChannels(prev =>
            prev.includes(channelId)
                ? prev.filter(id => id !== channelId)
                : [...prev, channelId]
        );
    };

    const handleTimeRangeChange = (newTimeRange: string) => {
        setTimeRange(newTimeRange);
        // Fetch stats will be triggered by useEffect
    };



    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Alert Testing
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Test alert delivery and view delivery statistics
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Test Alert Form */}
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                        Send Test Alert
                    </h2>

                    <div className="space-y-4">
                        {/* Severity Selection */}
                        <div>
                            <Label htmlFor="severity">Severity</Label>
                            <select
                                id="severity"
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value as any)}
                                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                            >
                                <option value="INFO">Info</option>
                                <option value="WARNING">Warning</option>
                                <option value="CRITICAL">Critical</option>
                            </select>
                        </div>

                        {/* Custom Message */}
                        <div>
                            <Label htmlFor="message">Custom Message (Optional)</Label>
                            <Textarea
                                id="message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Enter a custom test message..."
                                rows={3}
                                className="mt-1"
                            />
                        </div>

                        {/* Channel Selection */}
                        <div>
                            <Label>Notification Channels</Label>
                            <div className="mt-2 space-y-2">
                                {channels.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        No channels configured
                                    </p>
                                ) : (
                                    channels.map((channel) => (
                                        <div key={channel.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`channel-${channel.id}`}
                                                checked={selectedChannels.includes(channel.id)}
                                                onCheckedChange={() => handleChannelToggle(channel.id)}
                                                disabled={!channel.enabled}
                                            />
                                            <Label
                                                htmlFor={`channel-${channel.id}`}
                                                className="flex items-center space-x-2"
                                            >
                                                <span>{channel.name}</span>
                                                <Badge variant={channel.enabled ? 'default' : 'secondary'}>
                                                    {channel.type}
                                                </Badge>
                                                {!channel.enabled && (
                                                    <Badge variant="secondary">Disabled</Badge>
                                                )}
                                            </Label>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Send Button */}
                        <Button
                            onClick={handleSendTestAlert}
                            disabled={isSending || selectedChannels.length === 0}
                            className="w-full"
                        >
                            {isSending ? 'Sending...' : 'Send Test Alert'}
                        </Button>
                    </div>
                </Card>

                {/* Test Results */}
                {testResult && (
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                            Test Results
                        </h2>

                        <div className="space-y-4">
                            {/* Statistics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        {testResult.statistics.totalChannels}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Total Channels
                                    </div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {testResult.statistics.successCount}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Successful
                                    </div>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                        {testResult.statistics.failureCount}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Failed
                                    </div>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                        {testResult.statistics.successRate.toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Success Rate
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Results */}
                            <div>
                                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
                                    Delivery Details
                                </h3>
                                <div className="space-y-2">
                                    {testResult.deliveryResults.map((result, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {channels.find(c => c.id === result.channel)?.name || result.channel}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {result.success ? (
                                                    <Badge variant="default" className="bg-green-600">
                                                        ✓ Delivered
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive">
                                                        ✗ Failed
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Delivery Statistics */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Delivery Statistics
                    </h2>
                    <select
                        value={timeRange}
                        onChange={(e) => handleTimeRangeChange(e.target.value)}
                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    >
                        <option value="1h">Last Hour</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                </div>

                {isLoadingStats ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                ) : stats ? (
                    <div className="space-y-6">
                        {/* Overall Statistics */}
                        <div>
                            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                                Overall Performance
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {stats.overall.totalAlerts}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Total Alerts
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {stats.overall.totalNotifications}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Notifications Sent
                                    </div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {stats.overall.successfulNotifications}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Delivered
                                    </div>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                        {stats.overall.failedNotifications}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Failed
                                    </div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        {stats.overall.successRate.toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Success Rate
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* By Channel Statistics */}
                        <div>
                            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                                Performance by Channel
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Channel
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Sent
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Delivered
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Failed
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Success Rate
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                        {Object.entries(stats.byChannel).map(([channelId, channelStats]) => {
                                            const channel = channels.find(c => c.id === channelId);
                                            return (
                                                <tr key={channelId}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                        {channel?.name || channelId}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {channelStats.sent}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                                                        {channelStats.delivered}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                                                        {channelStats.failed}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                <div
                                                                    className="bg-blue-600 h-2 rounded-full"
                                                                    style={{ width: `${channelStats.successRate}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-sm font-medium">
                                                                {channelStats.successRate.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Failures */}
                        {stats.recentFailures.length > 0 && (
                            <div>
                                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                                    Recent Failures
                                </h3>
                                <div className="space-y-2">
                                    {stats.recentFailures.map((failure, index) => (
                                        <div
                                            key={index}
                                            className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            {failure.ruleName}
                                                        </span>
                                                        <Badge variant="destructive">
                                                            {failure.severity}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                                        Channel: {channels.find(c => c.id === failure.channel)?.name || failure.channel}
                                                    </div>
                                                    <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                        Error: {failure.error}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(failure.triggeredAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No statistics available
                    </div>
                )}
            </Card>
        </div>
    );
}
