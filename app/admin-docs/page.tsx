import Link from 'next/link';
import { documentationService } from '@/lib/documentation/service';

export const metadata = {
    title: 'Admin Documentation - PricePilot',
    description: 'Technical documentation for PricePilot system administrators',
};

export default async function AdminDocsIndexPage() {
    // Get table of contents for admin documentation
    const toc = await documentationService.getTableOfContents('admin');

    return (
        <div className="prose prose-gray dark:prose-invert max-w-none">
            <h1>Admin Documentation</h1>
            <p className="lead">
                Welcome to the PricePilot admin documentation. This technical documentation
                is designed for system administrators and covers system monitoring, tenant
                management, database operations, security configurations, performance tuning,
                and alerting systems.
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {toc.map((category) => (
                    <div
                        key={category.slug}
                        className="not-prose rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                    >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            {category.title}
                        </h3>
                        {category.children && category.children.length > 0 && (
                            <ul className="space-y-2 mt-4">
                                {category.children.map((doc) => (
                                    <li key={doc.slug}>
                                        <Link
                                            href={`/admin-docs/${doc.slug}`}
                                            className="text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            {doc.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Quick Links
                </h2>
                <ul className="space-y-2">
                    <li>
                        <Link
                            href="/admin-docs/system-monitoring/health-checks"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            System Health Checks
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/admin-docs/security/api-security"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            API Security Configuration
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/admin-docs/database/backup-restore"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Database Backup & Restore
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/admin-docs/alerting/alert-configuration"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Alert Configuration
                        </Link>
                    </li>
                </ul>
            </div>
        </div>
    );
}
