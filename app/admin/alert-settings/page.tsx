/**
 * Admin Alert Settings Page
 * 
 * Allows administrators to configure alert thresholds and rules.
 * Supports both global and per-tenant alert customization.
 * 
 * Requirements: 2.15.3
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AlertRule {
    id: string;
    tenantId: string | null;
    name: string;
    description: string | null;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    enabled: boolean;
    metricType: string;
    conditionOperator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ';
    conditionAggregation: 'COUNT' | 'AVG' | 'SUM' | 'MAX' | 'MIN' | 'P95' | 'P99';
    timeWindowSeconds: number;
    threshold: number;
    notificationChannels: string[];
}

interface Tenant {
    id: string;
    companyName: string;
}

export default function AlertSettingsPage() {
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<string>('global');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editingRule, setEditingRule] = useState<Partial<AlertRule> | null>(null);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTenant]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load tenants for dropdown
            const tenantsRes = await fetch('/api/v1/admin/tenants');
            if (tenantsRes.ok) {
                const tenantsData = await tenantsRes.json();
                setTenants(tenantsData.data || []);
            }

            // Load alert rules
            const tenantParam = selectedTenant === 'global' ? '' : `?tenantId=${selectedTenant}`;
            const rulesRes = await fetch(`/api/v1/monitoring/alert-rules${tenantParam}`);
            if (rulesRes.ok) {
                const rulesData = await rulesRes.json();
                setRules(rulesData.data || []);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            setMessage({ type: 'error', text: 'Failed to load alert settings' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRule = async (rule: Partial<AlertRule>) => {
        try {
            setSaving(true);
            setMessage(null);

            const url = rule.id
                ? `/api/v1/monitoring/alert-rules/${rule.id}`
                : '/api/v1/monitoring/alert-rules';

            const method = rule.id ? 'PUT' : 'POST';

            const payload = {
                ...rule,
                tenantId: selectedTenant === 'global' ? null : selectedTenant,
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to save rule');
            }

            setMessage({ type: 'success', text: 'Alert rule saved successfully' });
            setEditingRule(null);
            await loadData();
        } catch (error) {
            console.error('Failed to save rule:', error);
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Failed to save rule',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        if (!confirm('Are you sure you want to delete this alert rule?')) {
            return;
        }

        try {
            setSaving(true);
            setMessage(null);

            const res = await fetch(`/api/v1/monitoring/alert-rules/${ruleId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Failed to delete rule');
            }

            setMessage({ type: 'success', text: 'Alert rule deleted successfully' });
            await loadData();
        } catch (error) {
            console.error('Failed to delete rule:', error);
            setMessage({ type: 'error', text: 'Failed to delete rule' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleRule = async (ruleId: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/v1/monitoring/alert-rules/${ruleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });

            if (!res.ok) {
                throw new Error('Failed to update rule');
            }

            await loadData();
        } catch (error) {
            console.error('Failed to toggle rule:', error);
            setMessage({ type: 'error', text: 'Failed to update rule' });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Alert Settings</h1>
                    <p className="text-muted-foreground">
                        Configure alert thresholds and notification rules
                    </p>
                </div>
                <Button onClick={() => setEditingRule({})}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Alert Rule
                </Button>
            </div>

            {message && (
                <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                    {message.type === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                    ) : (
                        <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            )}

            <Tabs value={selectedTenant} onValueChange={setSelectedTenant}>
                <TabsList>
                    <TabsTrigger value="global">Global Rules</TabsTrigger>
                    {tenants.map((tenant) => (
                        <TabsTrigger key={tenant.id} value={tenant.id}>
                            {tenant.companyName}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value={selectedTenant} className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {selectedTenant === 'global' ? 'Global Alert Rules' : 'Tenant-Specific Rules'}
                            </CardTitle>
                            <CardDescription>
                                {selectedTenant === 'global'
                                    ? 'These rules apply to all tenants unless overridden'
                                    : 'These rules override global settings for this tenant'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {rules.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        No alert rules configured
                                    </p>
                                ) : (
                                    rules.map((rule) => (
                                        <Card key={rule.id}>
                                            <CardContent className="pt-6">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-semibold">{rule.name}</h3>
                                                            <Badge
                                                                variant={
                                                                    rule.severity === 'CRITICAL'
                                                                        ? 'destructive'
                                                                        : rule.severity === 'WARNING'
                                                                            ? 'default'
                                                                            : 'secondary'
                                                                }
                                                            >
                                                                {rule.severity}
                                                            </Badge>
                                                            {rule.tenantId && (
                                                                <Badge variant="outline">Tenant Override</Badge>
                                                            )}
                                                        </div>
                                                        {rule.description && (
                                                            <p className="text-sm text-muted-foreground">
                                                                {rule.description}
                                                            </p>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div>
                                                                <span className="font-medium">Metric:</span> {rule.metricType}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Threshold:</span>{' '}
                                                                {rule.conditionOperator} {rule.threshold}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Time Window:</span>{' '}
                                                                {rule.timeWindowSeconds}s
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Aggregation:</span>{' '}
                                                                {rule.conditionAggregation}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={rule.enabled}
                                                            onCheckedChange={(checked) =>
                                                                handleToggleRule(rule.id, checked)
                                                            }
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setEditingRule(rule)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDeleteRule(rule.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {editingRule && (
                <AlertRuleEditor
                    rule={editingRule}
                    onSave={handleSaveRule}
                    onCancel={() => setEditingRule(null)}
                    saving={saving}
                />
            )}
        </div>
    );
}

interface AlertRuleEditorProps {
    rule: Partial<AlertRule>;
    onSave: (rule: Partial<AlertRule>) => void;
    onCancel: () => void;
    saving: boolean;
}

function AlertRuleEditor({ rule, onSave, onCancel, saving }: AlertRuleEditorProps) {
    const [formData, setFormData] = useState<Partial<AlertRule>>(rule);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{rule.id ? 'Edit Alert Rule' : 'New Alert Rule'}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Rule Name</Label>
                            <Input
                                id="name"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="severity">Severity</Label>
                            <Select
                                value={formData.severity || 'WARNING'}
                                onValueChange={(value: any) =>
                                    setFormData({ ...formData, severity: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                    <SelectItem value="WARNING">Warning</SelectItem>
                                    <SelectItem value="INFO">Info</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="metricType">Metric Type</Label>
                            <Input
                                id="metricType"
                                value={formData.metricType || ''}
                                onChange={(e) => setFormData({ ...formData, metricType: e.target.value })}
                                placeholder="e.g., error_rate, response_time"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="threshold">Threshold</Label>
                            <Input
                                id="threshold"
                                type="number"
                                step="0.01"
                                value={formData.threshold || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, threshold: parseFloat(e.target.value) })
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="operator">Condition Operator</Label>
                            <Select
                                value={formData.conditionOperator || 'GT'}
                                onValueChange={(value: any) =>
                                    setFormData({ ...formData, conditionOperator: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GT">Greater Than (&gt;)</SelectItem>
                                    <SelectItem value="GTE">Greater Than or Equal (&gt;=)</SelectItem>
                                    <SelectItem value="LT">Less Than (&lt;)</SelectItem>
                                    <SelectItem value="LTE">Less Than or Equal (&lt;=)</SelectItem>
                                    <SelectItem value="EQ">Equal (=)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="aggregation">Aggregation</Label>
                            <Select
                                value={formData.conditionAggregation || 'AVG'}
                                onValueChange={(value: any) =>
                                    setFormData({ ...formData, conditionAggregation: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="COUNT">Count</SelectItem>
                                    <SelectItem value="AVG">Average</SelectItem>
                                    <SelectItem value="SUM">Sum</SelectItem>
                                    <SelectItem value="MAX">Maximum</SelectItem>
                                    <SelectItem value="MIN">Minimum</SelectItem>
                                    <SelectItem value="P95">95th Percentile</SelectItem>
                                    <SelectItem value="P99">99th Percentile</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="timeWindow">Time Window (seconds)</Label>
                            <Input
                                id="timeWindow"
                                type="number"
                                value={formData.timeWindowSeconds || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, timeWindowSeconds: parseInt(e.target.value) })
                                }
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Input
                            id="description"
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            checked={formData.enabled !== false}
                            onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                        />
                        <Label>Enabled</Label>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Rule
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
