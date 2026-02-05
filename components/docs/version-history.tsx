"use client";

import { useState } from 'react';
import { Clock, User, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface DocumentVersion {
    id: string;
    documentId: string;
    content: string;
    changeDescription: string;
    createdBy: string;
    createdAt: Date;
}

interface VersionHistoryProps {
    documentId: string;
    versions: DocumentVersion[];
    onRevert: (versionId: string) => Promise<void>;
}

export function VersionHistory({ versions, onRevert }: VersionHistoryProps) {
    const [isReverting, setIsReverting] = useState(false);
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

    const handleRevert = async (versionId: string) => {
        if (!confirm('Are you sure you want to revert to this version? This will create a new version entry.')) {
            return;
        }

        setIsReverting(true);
        try {
            await onRevert(versionId);
        } catch (error) {
            console.error('Failed to revert version:', error);
        } finally {
            setIsReverting(false);
        }
    };

    const toggleExpanded = (versionId: string) => {
        setExpandedVersions((prev) => {
            const next = new Set(prev);
            if (next.has(versionId)) {
                next.delete(versionId);
            } else {
                next.add(versionId);
            }
            return next;
        });
    };

    const generateDiff = (oldContent: string, newContent: string): Array<{ type: 'added' | 'removed' | 'unchanged'; line: string }> => {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diff: Array<{ type: 'added' | 'removed' | 'unchanged'; line: string }> = [];

        // Simple line-by-line diff (not a full LCS algorithm, but sufficient for display)
        const maxLength = Math.max(oldLines.length, newLines.length);

        for (let i = 0; i < maxLength; i++) {
            const oldLine = oldLines[i];
            const newLine = newLines[i];

            if (oldLine === newLine) {
                diff.push({ type: 'unchanged', line: oldLine || '' });
            } else {
                if (oldLine !== undefined) {
                    diff.push({ type: 'removed', line: oldLine });
                }
                if (newLine !== undefined) {
                    diff.push({ type: 'added', line: newLine });
                }
            }
        }

        return diff;
    };

    const renderDiff = (versionIndex: number) => {
        if (versionIndex === versions.length - 1) {
            // First version, no diff
            return (
                <div className="text-sm text-muted-foreground italic p-4 bg-muted/30 rounded">
                    Initial version - no changes to compare
                </div>
            );
        }

        const currentVersion = versions[versionIndex];
        const previousVersion = versions[versionIndex + 1];
        const diff = generateDiff(previousVersion.content, currentVersion.content);

        // Show only changed lines and some context
        const changedIndices = diff
            .map((line, idx) => (line.type !== 'unchanged' ? idx : -1))
            .filter((idx) => idx !== -1);

        if (changedIndices.length === 0) {
            return (
                <div className="text-sm text-muted-foreground italic p-4 bg-muted/30 rounded">
                    No content changes detected
                </div>
            );
        }

        // Show changed lines with 2 lines of context
        const linesToShow = new Set<number>();
        changedIndices.forEach((idx) => {
            for (let i = Math.max(0, idx - 2); i <= Math.min(diff.length - 1, idx + 2); i++) {
                linesToShow.add(i);
            }
        });

        const sortedLines = Array.from(linesToShow).sort((a, b) => a - b);

        return (
            <ScrollArea className="h-[400px] w-full rounded border border-border">
                <div className="p-4 font-mono text-xs">
                    {sortedLines.map((idx, arrayIdx) => {
                        const line = diff[idx];
                        const showEllipsis = arrayIdx > 0 && sortedLines[arrayIdx - 1] !== idx - 1;

                        return (
                            <div key={idx}>
                                {showEllipsis && (
                                    <div className="py-1 text-muted-foreground">...</div>
                                )}
                                <div
                                    className={cn(
                                        'py-0.5 px-2',
                                        line.type === 'added' && 'bg-green-500/10 text-green-700 dark:text-green-400',
                                        line.type === 'removed' && 'bg-red-500/10 text-red-700 dark:text-red-400',
                                        line.type === 'unchanged' && 'text-muted-foreground'
                                    )}
                                >
                                    <span className="mr-2 inline-block w-4">
                                        {line.type === 'added' && '+'}
                                        {line.type === 'removed' && '-'}
                                        {line.type === 'unchanged' && ' '}
                                    </span>
                                    {line.line || ' '}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        );
    };

    if (versions.length === 0) {
        return (
            <Card className="p-6">
                <div className="text-center text-muted-foreground">
                    <Clock className="mx-auto h-12 w-12 mb-3 opacity-50" />
                    <p>No version history available</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Version History</h3>
                <Badge variant="secondary">{versions.length} versions</Badge>
            </div>

            <div className="space-y-3">
                {versions.map((version, index) => {
                    const isExpanded = expandedVersions.has(version.id);
                    const isLatest = index === 0;

                    return (
                        <Card key={version.id} className={cn(
                            'overflow-hidden transition-all',
                            isExpanded && 'ring-2 ring-primary/20'
                        )}>
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            {isLatest && (
                                                <Badge variant="default" className="text-xs">
                                                    Current
                                                </Badge>
                                            )}
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                <span>
                                                    {new Date(version.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{version.createdBy}</span>
                                        </div>

                                        {version.changeDescription && (
                                            <p className="text-sm text-muted-foreground">
                                                {version.changeDescription}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!isLatest && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRevert(version.id)}
                                                disabled={isReverting}
                                            >
                                                <RotateCcw className="h-4 w-4 mr-1" />
                                                Revert
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleExpanded(version.id)}
                                        >
                                            {isExpanded ? (
                                                <>
                                                    <ChevronUp className="h-4 w-4 mr-1" />
                                                    Hide
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="h-4 w-4 mr-1" />
                                                    View Changes
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <>
                                        <Separator className="my-4" />
                                        <div>
                                            <h4 className="text-sm font-semibold mb-3">
                                                Changes from previous version
                                            </h4>
                                            {renderDiff(index)}
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
