/**
 * Staleness Configuration Form Component
 * 
 * Allows administrators to configure the staleness threshold for last known good prices.
 * 
 * Requirements: 14.4
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StalenessConfig {
    thresholdDays: number;
    thresholdMs: number;
}

export function StalenessConfigForm() {
    const [config, setConfig] = useState<StalenessConfig | null>(null);
    const [thresholdDays, setThresholdDays] = useState<number>(7);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Load current configuration
    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/v1/scraping/staleness-config');
            const data = await response.json();

            if (data.success) {
                setConfig(data.data);
                setThresholdDays(data.data.thresholdDays);
            } else {
                setError(data.error?.message || 'Failed to load configuration');
            }
        } catch (err) {
            setError('Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            const response = await fetch('/api/v1/scraping/staleness-config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    thresholdDays,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setConfig(data.data);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(data.error?.message || 'Failed to save configuration');
            }
        } catch (err) {
            setError('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Staleness Threshold</CardTitle>
                    <CardDescription>
                        Configure when last known good prices are considered stale
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Staleness Threshold</CardTitle>
                <CardDescription>
                    Configure when last known good prices are considered stale
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="bg-success/10 text-success border-success/20">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>Configuration saved successfully</AlertDescription>
                    </Alert>
                )}

                <div className="space-y-2">
                    <Label htmlFor="thresholdDays">Staleness Threshold (days)</Label>
                    <Input
                        id="thresholdDays"
                        type="number"
                        min={1}
                        max={90}
                        value={thresholdDays}
                        onChange={(e) => setThresholdDays(parseInt(e.target.value) || 1)}
                        disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                        Prices older than this threshold will be marked as stale. Must be between 1
                        and 90 days.
                    </p>
                </div>

                {config && (
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-medium">Current Configuration</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Threshold (days)</p>
                                <p className="font-semibold">{config.thresholdDays} days</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Threshold (hours)</p>
                                <p className="font-semibold">
                                    {(config.thresholdMs / (1000 * 60 * 60)).toFixed(0)} hours
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={loadConfig} disabled={saving}>
                        Reset
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Configuration'
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
