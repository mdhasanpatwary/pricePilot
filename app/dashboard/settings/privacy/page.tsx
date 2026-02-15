/**
 * Privacy Settings Page
 *
 * GDPR compliance interface for users to:
 * - Export their data
 * - Delete their account
 * - Manage privacy preferences
 */

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Download,
    Trash2,
    Shield,
    AlertTriangle,
    CheckCircle2,
    FileText,
    Mail,
    ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function PrivacySettingsPage() {
    const { data: session } = useSession();
    const [exportLoading, setExportLoading] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteSuccess, setDeleteSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleExportData = async (deliveryMethod: 'download' | 'email') => {
        try {
            setExportLoading(true);
            setError('');
            setExportSuccess(false);

            if (deliveryMethod === 'download') {
                // Download directly
                const response = await fetch('/api/v1/gdpr/export', {
                    method: 'GET',
                });

                if (!response.ok) {
                    throw new Error('Failed to export data');
                }

                // Download the file
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pricepilot-data-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                setExportSuccess(true);
            } else {
                // Send via email
                const response = await fetch('/api/v1/gdpr/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deliveryMethod: 'email' }),
                });

                if (!response.ok) {
                    throw new Error('Failed to request data export');
                }

                setExportSuccess(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export data');
        } finally {
            setExportLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            setDeleteLoading(true);
            setError('');
            setDeleteSuccess(false);

            const response = await fetch('/api/v1/gdpr/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    confirmEmail: deleteConfirmEmail,
                    reason: deleteReason,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to request account deletion');
            }

            setDeleteSuccess(true);
            setDeleteConfirmEmail('');
            setDeleteReason('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to request account deletion');
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="flex items-center gap-4 mb-8">
                <Link
                  href="/dashboard/settings"
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold mb-2">Privacy & Data Management</h1>
                    <p className="text-muted-foreground">
                        Manage your personal data and exercise your privacy rights under GDPR
                    </p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Data Export Section */}
            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        <CardTitle>Export Your Data</CardTitle>
                    </div>
                    <CardDescription>
                        Download a copy of all your personal data stored in PricePilot (GDPR Article 15 & 20)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {exportSuccess && (
                        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <AlertDescription className="text-green-800 dark:text-green-200">
                                Data export successful! Check your downloads or email.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-3">
                        <h4 className="font-semibold">What&apos;s included in your export:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Your account and profile information</li>
                            <li>Company/tenant information</li>
                            <li>Connected sites and integrations</li>
                            <li>Product data (up to 10,000 products)</li>
                            <li>Price history (up to 5,000 records)</li>
                            <li>Your audit logs (up to 1,000 records)</li>
                            <li>Notifications (up to 1,000 records)</li>
                            <li>API keys (metadata only)</li>
                        </ul>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            onClick={() => handleExportData('download')}
                            disabled={exportLoading}
                            className="flex items-center gap-2"
                        >
                            <Download className="h-4 w-4" />
                            {exportLoading ? 'Exporting...' : 'Download Now'}
                        </Button>
                        <Button
                            onClick={() => handleExportData('email')}
                            disabled={exportLoading}
                            variant="outline"
                            className="flex items-center gap-2"
                        >
                            <Mail className="h-4 w-4" />
                            {exportLoading ? 'Sending...' : 'Send via Email'}
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Data is provided in JSON format, which is machine-readable and can be imported into other systems.
                    </p>
                </CardContent>
            </Card>

            {/* Privacy Rights Section */}
            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        <CardTitle>Your Privacy Rights</CardTitle>
                    </div>
                    <CardDescription>
                        Under GDPR, you have the following rights regarding your personal data
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <h4 className="font-semibold">Right to Access</h4>
                                <p className="text-sm text-muted-foreground">
                                    Request a copy of your personal data (use the export feature above)
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <h4 className="font-semibold">Right to Rectification</h4>
                                <p className="text-sm text-muted-foreground">
                                    Update incorrect data in your{' '}
                                    <a href="/dashboard/settings/profile" className="text-primary hover:underline">
                                        profile settings
                                    </a>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <h4 className="font-semibold">Right to Erasure</h4>
                                <p className="text-sm text-muted-foreground">
                                    Request deletion of your account and data (see below)
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <h4 className="font-semibold">Right to Data Portability</h4>
                                <p className="text-sm text-muted-foreground">
                                    Transfer your data to another service (use the export feature above)
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t">
                        <h4 className="font-semibold mb-2">Learn More</h4>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" size="sm" asChild>
                                <a href="/legal/privacy" target="_blank" className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Privacy Policy
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <a href="/legal/data-retention" target="_blank" className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Data Retention Policy
                                </a>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Account Deletion Section */}
            <Card className="border-destructive">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-destructive" />
                        <CardTitle className="text-destructive">Delete Account</CardTitle>
                    </div>
                    <CardDescription>
                        Permanently delete your account and all associated data (GDPR Article 17)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {deleteSuccess && (
                        <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                                Account deletion requested. You have 30 days to cancel before permanent deletion.
                                Check your email for details.
                            </AlertDescription>
                        </Alert>
                    )}

                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Warning:</strong> This action cannot be undone after the 30-day recovery period.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                        <h4 className="font-semibold">What happens when you delete your account:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li><strong>Immediate:</strong> Account marked for deletion</li>
                            <li><strong>30-Day Period:</strong> You can still log in and cancel</li>
                            <li><strong>After 30 Days:</strong> Permanent deletion of all data</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-semibold">What will be deleted:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Your user account and profile</li>
                            <li>All connected sites and integrations</li>
                            <li>All product data and price history</li>
                            <li>All notifications and API keys</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-semibold">What will be retained:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Audit logs (anonymized after 2 years)</li>
                            <li>Financial records (as required by law)</li>
                        </ul>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div>
                            <Label htmlFor="confirmEmail">
                                Confirm your email address to proceed
                            </Label>
                            <Input
                                id="confirmEmail"
                                type="email"
                                placeholder={session?.user?.email || 'your@email.com'}
                                value={deleteConfirmEmail}
                                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="deleteReason">
                                Reason for deletion (optional)
                            </Label>
                            <Textarea
                                id="deleteReason"
                                placeholder="Help us improve by telling us why you're leaving..."
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                className="mt-1"
                                rows={3}
                            />
                        </div>

                        <Button
                            onClick={handleDeleteAccount}
                            disabled={
                                deleteLoading ||
                                !deleteConfirmEmail ||
                                deleteConfirmEmail !== session?.user?.email
                            }
                            variant="destructive"
                            className="w-full"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {deleteLoading ? 'Processing...' : 'Delete My Account'}
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                            By clicking &quot;Delete My Account&quot;, you confirm that you understand this action and
                            agree to the 30-day recovery period.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Contact Section */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Questions or Concerns?</CardTitle>
                    <CardDescription>
                        Contact our Data Protection Officer or support team
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm">
                        <p>
                            <strong>Data Protection Officer:</strong>{' '}
                            <a href="mailto:dpo@pricepilot.com" className="text-primary hover:underline">
                                dpo@pricepilot.com
                            </a>
                        </p>
                        <p>
                            <strong>Privacy Inquiries:</strong>{' '}
                            <a href="mailto:privacy@pricepilot.com" className="text-primary hover:underline">
                                privacy@pricepilot.com
                            </a>
                        </p>
                        <p>
                            <strong>General Support:</strong>{' '}
                            <a href="mailto:support@pricepilot.com" className="text-primary hover:underline">
                                support@pricepilot.com
                            </a>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
