/**
 * User Satisfaction Dashboard
 * 
 * Admin page for viewing user satisfaction metrics and feedback
 */

import { Metadata } from 'next';
import { SatisfactionDashboard } from '@/components/admin/satisfaction-dashboard';

export const metadata: Metadata = {
    title: 'User Satisfaction | PricePilot Admin',
    description: 'View user satisfaction metrics and feedback',
};

export default function SatisfactionPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    User Satisfaction
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Monitor user satisfaction scores and feedback across the platform
                </p>
            </div>

            <SatisfactionDashboard />
        </div>
    );
}
