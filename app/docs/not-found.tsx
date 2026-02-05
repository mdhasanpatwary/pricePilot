import Link from 'next/link';

export default function DocsNotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="max-w-md w-full text-center">
                <div className="mb-8">
                    <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        404
                    </h1>
                    <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
                        Page Not Found
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        The documentation page you are looking for could not be found. It may have been moved or deleted.
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Here&apos;s what you can do:
                    </h3>
                    <ul className="text-left space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Check the URL for typos</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Use the search function to find what you need</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Browse the documentation table of contents</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Return to the documentation home page</span>
                        </li>
                    </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/docs"
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Go to Documentation Home
                    </Link>
                    <Link
                        href="/docs/search"
                        className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Search Documentation
                    </Link>
                </div>
            </div>
        </div>
    );
}
