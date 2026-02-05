"use client";

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FeedbackWidgetProps {
    documentId: string;
}

export function FeedbackWidget({ documentId }: FeedbackWidgetProps) {
    const [rating, setRating] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [showCommentBox, setShowCommentBox] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleRating = async (value: number) => {
        setRating(value);
        setShowCommentBox(true);
    };

    const handleSubmit = async () => {
        if (rating === null) return;

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/v1/documentation/analytics/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId,
                    rating,
                    comment: comment.trim() || undefined,
                }),
            });

            if (response.ok) {
                setIsSubmitted(true);
                setTimeout(() => {
                    setIsSubmitted(false);
                    setRating(null);
                    setComment('');
                    setShowCommentBox(false);
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <Card className="p-6 bg-success/5 border-success/20">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                        <ThumbsUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-success">Thank you for your feedback!</h3>
                        <p className="text-sm text-muted-foreground">
                            Your input helps us improve our documentation.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold mb-2">Was this page helpful?</h3>
                    <p className="text-sm text-muted-foreground">
                        Let us know how we can improve this documentation.
                    </p>
                </div>

                {/* Rating buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        variant={rating === 5 ? 'default' : 'outline'}
                        size="lg"
                        onClick={() => handleRating(5)}
                        disabled={isSubmitting}
                        className={cn(
                            'flex-1 min-h-[3rem]',
                            rating === 5 && 'bg-success hover:bg-success/90'
                        )}
                    >
                        <ThumbsUp className="h-5 w-5 mr-2 flex-shrink-0" />
                        <span className="text-sm sm:text-base">Yes, helpful</span>
                    </Button>
                    <Button
                        variant={rating === 1 ? 'default' : 'outline'}
                        size="lg"
                        onClick={() => handleRating(1)}
                        disabled={isSubmitting}
                        className={cn(
                            'flex-1 min-h-[3rem]',
                            rating === 1 && 'bg-destructive hover:bg-destructive/90'
                        )}
                    >
                        <ThumbsDown className="h-5 w-5 mr-2 flex-shrink-0" />
                        <span className="text-sm sm:text-base">Needs work</span>
                    </Button>
                </div>

                {/* Comment box */}
                {showCommentBox && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-2">
                            <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
                            <div className="flex-1 space-y-2">
                                <Textarea
                                    placeholder="Tell us more about your experience (optional)"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                    className="resize-none"
                                />
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        size="sm"
                                    >
                                        {isSubmitting ? (
                                            'Submitting...'
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4 mr-2" />
                                                Submit Feedback
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
