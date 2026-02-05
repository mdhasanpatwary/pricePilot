import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DocumentationLayout } from '@/components/docs/documentation-layout';

export const metadata = {
    title: 'Admin Documentation - PricePilot',
    description: 'Technical documentation for PricePilot system administrators',
};

export default async function AdminDocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Get the current session
    const session = await getServerSession(authOptions);

    // Redirect unauthenticated users to login
    if (!session) {
        redirect('/auth/login?callbackUrl=/admin-docs');
    }

    // Return 403 for non-admin authenticated users
    // Check both isSuperAdmin flag and role
    const isAdmin = session.user?.isSuperAdmin || session.user?.role === 'admin';

    if (!isAdmin) {
        // Return a 403 Forbidden page
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100">403</h1>
                    <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
                        Access Forbidden
                    </p>
                    <p className="mt-2 text-gray-500 dark:text-gray-500">
                        You do not have permission to access admin documentation.
                    </p>
                    <a
                        href="/dashboard"
                        className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                        Return to Dashboard
                    </a>
                </div>
            </div>
        );
    }

    // Render admin documentation layout for authenticated admin users
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DocumentationLayout type="admin">
                {children}
            </DocumentationLayout>
        </Suspense>
    );
}
