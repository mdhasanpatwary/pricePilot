'use client';

/**
 * Feedback Widget Component
 * 
 * Displays a feedback prompt to users at appropriate times
 */

import { useState, useEffect } from 'react';
import { Star, X, Send } from 'lucide-react';
import { toast } from 'sonner';

interface FeedbackWidgetProps {
    trigger?: 'manual' | 'auto';
    category?: string;
    feature?: string;
    context?: Record<string, any>;
}

export function FeedbackWidget({
    trigger = 'auto',
    category = 'OVERALL_EXPERIENCE',
    feature,
    context,
}: FeedbackWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (trigger === 'auto') {
            checkShouldPrompt();
        }
    }, [trigger]);

    const checkShouldPrompt = async () => {
        try {
            const response = await fetch('/api/v1/feedback/should-prompt');
            const data = await response.json();

            if (data.success && data.data.shouldPrompt) {
                // Delay showing the prompt by 5 seconds
                setTimeout(() => {
                    setIsOpen(true);
                }, 5000);
            }
        } catch (error) {
            console.error('Failed to check if should prompt:', error);
        }
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/v1/feedback/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rating,
                    category,
                    feature,
                    comment: comment.trim() || undefined,
                    context,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Thank you for your feedback!');
                setIsOpen(false);
                setRating(0);
                setComment('');
            } else {
                toast.error(data.error || 'Failed to submit feedback');
            }
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            toast.error('Failed to submit feedback');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen && trigger === 'auto') {
        return null;
    }

    if (trigger === 'manual' && !isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2 z-50"
            >
                <Star className="w-4 h-4" />
                Give Feedback
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-96 z-50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        How are we doing?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Your feedback helps us improve PricePilot
                    </p>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rate your experience
                </label>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="transition-transform hover:scale-110"
                        >
                            <Star
                                className={`w-8 h-8 ${star <= (hoveredRating || rating)
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-gray-300 dark:text-gray-600'
                                    }`}
                            />
                        </button>
                    ))}
                </div>
                {rating > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {rating === 5 && '⭐ Excellent!'}
                        {rating === 4 && '👍 Good'}
                        {rating === 3 && '😐 Okay'}
                        {rating === 2 && '👎 Poor'}
                        {rating === 1 && '😞 Very Poor'}
                    </p>
                )}
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tell us more (optional)
                </label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="What could we improve?"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    rows={3}
                    maxLength={2000}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {comment.length}/2000 characters
                </p>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    Maybe Later
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || rating === 0}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        'Submitting...'
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            Submit
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
