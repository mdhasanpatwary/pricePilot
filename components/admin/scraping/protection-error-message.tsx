'use client';

/**
 * Protection Error Message Component
 * 
 * Displays user-friendly error messages for bot protection failures
 * on competitor product pages.
 * 
 * Requirements: 10.1, 10.2
 */

import { AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { ErrorMessageGenerator, ProtectionType } from '@/lib/services/bot-protection/error-message-generator';
import { ManualPriceEntryButton } from './manual-price-entry-button';

interface ProtectionErrorMessageProps {
    protectionType: ProtectionType;
    competitorSiteName: string;
    lastSuccessfulScrape?: Date;
    className?: string;
    // Optional props for manual price entry
    productId?: string;
    productTitle?: string;
    currency?: string;
    onManualPriceSuccess?: () => void;
}

export function ProtectionErrorMessage({
    protectionType,
    competitorSiteName,
    lastSuccessfulScrape,
    className = '',
    productId,
    productTitle,
    currency = 'USD',
    onManualPriceSuccess,
}: ProtectionErrorMessageProps) {
    const errorMessage = ErrorMessageGenerator.generateMessage(
        protectionType,
        competitorSiteName,
        lastSuccessfulScrape
    );

    // Select icon based on severity
    const Icon = errorMessage.severity === 'error'
        ? AlertCircle
        : errorMessage.severity === 'warning'
            ? AlertTriangle
            : Info;

    // Select color based on severity
    const colorClasses = {
        error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
        warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
        info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
    };

    const iconColorClasses = {
        error: 'text-red-600 dark:text-red-400',
        warning: 'text-yellow-600 dark:text-yellow-400',
        info: 'text-blue-600 dark:text-blue-400'
    };

    const textColorClasses = {
        error: 'text-red-900 dark:text-red-100',
        warning: 'text-yellow-900 dark:text-yellow-100',
        info: 'text-blue-900 dark:text-blue-100'
    };

    return (
        <div
            className={`rounded-lg border p-4 ${colorClasses[errorMessage.severity]} ${className}`}
            role="alert"
        >
            <div className="flex gap-3">
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColorClasses[errorMessage.severity]}`} />

                <div className="flex-1 space-y-2">
                    <div>
                        <h4 className={`font-semibold ${textColorClasses[errorMessage.severity]}`}>
                            {errorMessage.title}
                        </h4>
                        <p className={`text-sm mt-1 ${textColorClasses[errorMessage.severity]} opacity-90`}>
                            {errorMessage.message}
                        </p>
                    </div>

                    {errorMessage.suggestions.length > 0 && (
                        <div className="space-y-1">
                            <p className={`text-xs font-medium ${textColorClasses[errorMessage.severity]}`}>
                                What happens next:
                            </p>
                            <ul className={`text-xs space-y-1 ${textColorClasses[errorMessage.severity]} opacity-80`}>
                                {errorMessage.suggestions.map((suggestion, index) => (
                                    <li key={index} className="flex gap-2">
                                        <span className="flex-shrink-0">•</span>
                                        <span>{suggestion}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {errorMessage.requiresManualIntervention && (
                        <div className={`text-xs font-medium ${textColorClasses[errorMessage.severity]} pt-2 border-t ${errorMessage.severity === 'error'
                            ? 'border-red-200 dark:border-red-800'
                            : 'border-yellow-200 dark:border-yellow-800'
                            }`}>
                            ⚠️ Manual action may be required
                        </div>
                    )}

                    {/* Manual Price Entry Button */}
                    {productId && productTitle && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                            <ManualPriceEntryButton
                                productId={productId}
                                productTitle={productTitle}
                                competitorSiteName={competitorSiteName}
                                currency={currency}
                                onSuccess={onManualPriceSuccess}
                                variant="outline"
                                size="sm"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Compact version for table cells
 */
interface CompactProtectionErrorProps {
    protectionType: ProtectionType;
    className?: string;
}

export function CompactProtectionError({
    protectionType,
    className = ''
}: CompactProtectionErrorProps) {
    const shortMessage = ErrorMessageGenerator.generateShortMessage(protectionType);
    const colorClass = ErrorMessageGenerator.getSeverityColor(protectionType);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <AlertCircle className={`h-4 w-4 flex-shrink-0 ${colorClass}`} />
            <span className={`text-sm ${colorClass}`}>
                {shortMessage}
            </span>
        </div>
    );
}
