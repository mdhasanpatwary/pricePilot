'use client';

/**
 * Manual Price Entry Modal Component
 * 
 * Allows users to manually enter competitor prices when automated scraping fails.
 * Displays validation errors and shows confirmation on success.
 * 
 * Requirements: 13.1
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { DollarSign, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ManualPriceEntryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productId: string;
    productTitle: string;
    competitorSiteName: string;
    currency?: string;
    onSuccess?: () => void;
}

export function ManualPriceEntryModal({
    open,
    onOpenChange,
    productId,
    productTitle,
    competitorSiteName,
    currency = 'USD',
    onSuccess,
}: ManualPriceEntryModalProps) {
    const [price, setPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors([]);

        // Client-side validation
        const priceValue = parseFloat(price);
        const validationErrors: string[] = [];

        if (isNaN(priceValue)) {
            validationErrors.push('Please enter a valid number');
        } else if (priceValue <= 0) {
            validationErrors.push('Price must be greater than zero');
        } else if (priceValue >= 1000000) {
            validationErrors.push('Price must be less than $1,000,000');
        } else if (!/^\d+(\.\d{1,2})?$/.test(price)) {
            validationErrors.push('Price must have at most 2 decimal places');
        }

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(`/api/v1/competitor-products/${productId}/manual-price`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    price: priceValue,
                    currency,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.error?.details?.fields) {
                    // Handle validation errors from server
                    const fieldErrors = Object.values(data.error.details.fields).flat() as string[];
                    setErrors(fieldErrors);
                } else {
                    setErrors([data.error?.message || 'Failed to save manual price']);
                }
                return;
            }

            // Success
            toast.success('Manual price saved successfully', {
                description: `Price set to ${currency} ${priceValue.toFixed(2)}`,
            });

            // Reset form
            setPrice('');
            setErrors([]);
            onOpenChange(false);

            // Call success callback
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('Manual price entry error:', error);
            setErrors(['Network error. Please try again.']);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setPrice('');
        setErrors([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Enter Manual Price</DialogTitle>
                    <DialogDescription>
                        Enter the current price for this product from {competitorSiteName}.
                        This will be used until automated scraping succeeds.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="product-title" className="text-sm font-medium">
                                Product
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {productTitle}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="price" className="text-sm font-medium">
                                Price ({currency})
                            </Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="price"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="pl-9"
                                    disabled={isSubmitting}
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Enter the price as shown on the competitor website
                            </p>
                        </div>

                        {errors.length > 0 && (
                            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3">
                                <ul className="space-y-1">
                                    {errors.map((error, index) => (
                                        <li key={index} className="text-sm text-red-900 dark:text-red-100 flex gap-2">
                                            <span className="flex-shrink-0">•</span>
                                            <span>{error}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !price}
                        >
                            {isSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save Price
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
