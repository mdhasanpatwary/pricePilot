/**
 * Data Retention Policy Page
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Data Retention Policy | PricePilot',
    description: 'PricePilot Data Retention Policy - How long we keep your data',
};

export default function DataRetentionPage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8">Data Retention Policy</h1>

            <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-sm text-muted-foreground mb-8">
                    <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">1. Overview</h2>
                    <p>
                        This Data Retention Policy explains how long we keep different types of data and why.
                        We balance business needs, legal requirements, and your privacy rights.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">2. Retention Periods by Data Type</h2>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse border border-border">
                            <thead>
                                <tr className="bg-muted">
                                    <th className="border border-border px-4 py-2 text-left">Data Type</th>
                                    <th className="border border-border px-4 py-2 text-left">Retention Period</th>
                                    <th className="border border-border px-4 py-2 text-left">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-border px-4 py-2">Account Data</td>
                                    <td className="border border-border px-4 py-2">While active + 30 days</td>
                                    <td className="border border-border px-4 py-2">Service delivery, recovery period</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Product Data</td>
                                    <td className="border border-border px-4 py-2">While active</td>
                                    <td className="border border-border px-4 py-2">Service delivery</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Price History</td>
                                    <td className="border border-border px-4 py-2">90 days</td>
                                    <td className="border border-border px-4 py-2">Analytics, trend analysis</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Price Update Logs</td>
                                    <td className="border border-border px-4 py-2">180 days</td>
                                    <td className="border border-border px-4 py-2">Audit trail, troubleshooting</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Audit Logs</td>
                                    <td className="border border-border px-4 py-2">2 years</td>
                                    <td className="border border-border px-4 py-2">Compliance, security</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Notifications</td>
                                    <td className="border border-border px-4 py-2">90 days</td>
                                    <td className="border border-border px-4 py-2">User reference</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Sync Logs</td>
                                    <td className="border border-border px-4 py-2">30 days</td>
                                    <td className="border border-border px-4 py-2">Troubleshooting</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Sessions</td>
                                    <td className="border border-border px-4 py-2">7 days</td>
                                    <td className="border border-border px-4 py-2">Security monitoring</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Financial Records</td>
                                    <td className="border border-border px-4 py-2">7 years</td>
                                    <td className="border border-border px-4 py-2">Legal requirement</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">3. Account Deletion</h2>
                    <h3 className="text-xl font-semibold mb-3">3.1 Soft Delete (30 Days)</h3>
                    <p>
                        When you request account deletion, we implement a 30-day soft delete period:
                    </p>
                    <ul>
                        <li>Your account is marked for deletion</li>
                        <li>You can still log in and cancel the deletion</li>
                        <li>Your data remains accessible to you</li>
                        <li>No new data is collected</li>
                    </ul>

                    <h3 className="text-xl font-semibold mb-3 mt-6">3.2 Permanent Deletion (After 30 Days)</h3>
                    <p>After the 30-day recovery period:</p>
                    <ul>
                        <li>Your account is permanently deleted</li>
                        <li>All product data is deleted</li>
                        <li>All price history is deleted</li>
                        <li>All notifications are deleted</li>
                        <li>All API keys are revoked</li>
                    </ul>

                    <h3 className="text-xl font-semibold mb-3 mt-6">3.3 Data Retained After Deletion</h3>
                    <p>For legal and compliance reasons, we retain:</p>
                    <ul>
                        <li><strong>Audit Logs:</strong> Anonymized after 2 years</li>
                        <li><strong>Financial Records:</strong> As required by law (7 years)</li>
                        <li><strong>Legal Hold Data:</strong> If required by law enforcement</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">4. Automated Cleanup</h2>
                    <p>We run automated cleanup jobs to enforce retention policies:</p>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse border border-border">
                            <thead>
                                <tr className="bg-muted">
                                    <th className="border border-border px-4 py-2 text-left">Job</th>
                                    <th className="border border-border px-4 py-2 text-left">Frequency</th>
                                    <th className="border border-border px-4 py-2 text-left">Time (UTC)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-border px-4 py-2">Notifications Cleanup</td>
                                    <td className="border border-border px-4 py-2">Daily</td>
                                    <td className="border border-border px-4 py-2">1:00 AM</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Sync Logs Cleanup</td>
                                    <td className="border border-border px-4 py-2">Daily</td>
                                    <td className="border border-border px-4 py-2">1:30 AM</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Sessions Cleanup</td>
                                    <td className="border border-border px-4 py-2">Daily</td>
                                    <td className="border border-border px-4 py-2">2:00 AM</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Price History Cleanup</td>
                                    <td className="border border-border px-4 py-2">Daily</td>
                                    <td className="border border-border px-4 py-2">2:00 AM</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Price Update Logs Cleanup</td>
                                    <td className="border border-border px-4 py-2">Daily</td>
                                    <td className="border border-border px-4 py-2">2:30 AM</td>
                                </tr>
                                <tr>
                                    <td className="border border-border px-4 py-2">Audit Logs Cleanup</td>
                                    <td className="border border-border px-4 py-2">Monthly</td>
                                    <td className="border border-border px-4 py-2">3:00 AM (1st)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">5. Data Archival</h2>
                    <p>
                        Before deletion, some data is archived for compliance and disaster recovery:
                    </p>
                    <ul>
                        <li><strong>Archive Location:</strong> Encrypted cloud storage</li>
                        <li><strong>Archive Retention:</strong> As required by law</li>
                        <li><strong>Archive Access:</strong> Restricted to authorized personnel</li>
                        <li><strong>Archive Deletion:</strong> After legal retention period expires</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">6. Legal Holds</h2>
                    <p>
                        We may retain data beyond normal retention periods if:
                    </p>
                    <ul>
                        <li>Required by law or legal process</li>
                        <li>Needed for litigation or investigation</li>
                        <li>Subject to regulatory inquiry</li>
                        <li>Necessary to protect our rights</li>
                    </ul>
                    <p>
                        You will be notified if your data is subject to a legal hold, unless prohibited by law.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">7. Backup Retention</h2>
                    <p>We maintain backups for disaster recovery:</p>
                    <ul>
                        <li><strong>Daily Backups:</strong> Retained for 30 days</li>
                        <li><strong>Monthly Backups:</strong> Retained for 12 months</li>
                        <li><strong>Backup Encryption:</strong> AES-256-GCM</li>
                        <li><strong>Backup Location:</strong> Geographically distributed</li>
                    </ul>
                    <p>
                        Backups may contain deleted data until they expire. We cannot selectively delete data
                        from backups.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">8. Your Rights</h2>
                    <p>Under GDPR and other privacy laws, you have the right to:</p>
                    <ul>
                        <li><strong>Access:</strong> Request a copy of your data</li>
                        <li><strong>Rectification:</strong> Correct inaccurate data</li>
                        <li><strong>Erasure:</strong> Request deletion of your data</li>
                        <li><strong>Restriction:</strong> Limit how we process your data</li>
                        <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
                        <li><strong>Object:</strong> Object to certain types of processing</li>
                    </ul>
                    <p>
                        To exercise these rights, visit your{' '}
                        <a href="/dashboard/settings/privacy" className="text-primary hover:underline">Privacy Settings</a> or
                        contact us at{' '}
                        <a href="mailto:privacy@pricepilot.com" className="text-primary hover:underline">privacy@pricepilot.com</a>.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">9. Compliance</h2>
                    <p>This policy complies with:</p>
                    <ul>
                        <li><strong>GDPR:</strong> Article 5 (Storage Limitation)</li>
                        <li><strong>CCPA:</strong> Data retention and deletion requirements</li>
                        <li><strong>SOC 2:</strong> Data retention controls</li>
                        <li><strong>ISO 27001:</strong> Information security management</li>
                        <li><strong>PCI DSS:</strong> Payment data retention</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">10. Policy Updates</h2>
                    <p>
                        We may update this policy from time to time. Significant changes will be communicated
                        via email or through our service. Continued use after changes constitutes acceptance.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
                    <p>Questions about data retention?</p>
                    <ul>
                        <li><strong>Email:</strong> <a href="mailto:privacy@pricepilot.com" className="text-primary hover:underline">privacy@pricepilot.com</a></li>
                        <li><strong>Data Protection Officer:</strong> <a href="mailto:dpo@pricepilot.com" className="text-primary hover:underline">dpo@pricepilot.com</a></li>
                        <li><strong>Support:</strong> <a href="mailto:support@pricepilot.com" className="text-primary hover:underline">support@pricepilot.com</a></li>
                    </ul>
                </section>

                <div className="mt-12 p-6 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                        This data retention policy is effective as of {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} and
                        applies to all users of PricePilot.
                    </p>
                </div>
            </div>
        </div>
    );
}
