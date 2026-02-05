'use client';

/**
 * Manual Price Entry Button Component
 * 
 * Button to trigger manual price entry for failed competitor products.
 * 
 * Requirements: 13.1
 */

import { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManualPriceEntryModal } from './manual-price-entry-modal';

interface ManualPriceEntryButtonProps {
    productId: string;
    productTitle: string;
    competitorSiteName: string;
    currency?: string;
    onSuccess?: () => void;
    variant?: 'default' | 'outline' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
}

export function ManualPriceEntryButton({
    productId,
    productTitle,
    competitorSiteName,
    currency = 'USD',
    onSuccess,
    variant = 'outline',
    size = 'sm',
    className = '',
}: ManualPriceEntryButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <Button
                variant={variant}
                size={size}
                onClick={() => setIsModalOpen(true)}
                className={className}
            >
                <Edit3 className="h-4 w-4 mr-2" />
                Enter Price Manually
            </Button>

            <ManualPriceEntryModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                productId={productId}
                productTitle={productTitle}
                competitorSiteName={competitorSiteName}
                currency={currency}
                onSuccess={onSuccess}
            />
        </>
    );
}
