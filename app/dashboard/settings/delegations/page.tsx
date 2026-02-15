'use client';

/**
 * Approval Delegation Management Page
 *
 * Allows users to delegate their price approval authority to other team members.
 * Useful for vacation coverage, team collaboration, and workflow flexibility.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

interface User {
    id: string;
    name: string | null;
    email: string;
}

interface Delegation {
    id: string;
    fromUser: User;
    toUser: User;
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdAt: string;
}

export default function DelegationsPage() {
    const { data: session } = useSession();
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form state
    const [selectedUserId, setSelectedUserId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadDelegations = useCallback(async () => {
        try {
            const response = await fetch('/api/v1/approval-delegation');
            const data = await response.json();

            if (data.success) {
                setDelegations(data.data);
            }
        } catch (error) {
            console.error('Failed to load delegations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadUsers = useCallback(async () => {
        try {
            const response = await fetch('/api/v1/tenant/team?limit=100');
            const data = await response.json();

            if (data.data) {
                // Filter out current user
                setUsers(data.data.filter((u: User) => u.id !== session?.user?.id));
            }
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }, [session]);

    useEffect(() => {
        loadDelegations();
        loadUsers();
    }, [loadDelegations, loadUsers]);

    const handleCreateDelegation = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await fetch('/api/v1/approval-delegation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toUserId: selectedUserId,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                }),
            });

            const data = await response.json();

            if (data.success) {
                setIsDialogOpen(false);
                setSelectedUserId('');
                setStartDate('');
                setEndDate('');
                loadDelegations();
            } else {
                alert(data.error || 'Failed to create delegation');
            }
        } catch (error) {
            console.error('Failed to create delegation:', error);
            alert('Failed to create delegation');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevokeDelegation = async (delegationId: string) => {
        if (!confirm('Are you sure you want to revoke this delegation?')) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/approval-delegation/${delegationId}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                loadDelegations();
            } else {
                alert(data.error || 'Failed to revoke delegation');
            }
        } catch (error) {
            console.error('Failed to revoke delegation:', error);
            alert('Failed to revoke delegation');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const isActive = (delegation: Delegation) => {
        const now = new Date();
        const start = new Date(delegation.startDate);
        const end = new Date(delegation.endDate);
        return delegation.isActive && now >= start && now <= end;
    };

    if (loading) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Approval Delegations</h1>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="flex items-center gap-4">
                <Link
                  href="/dashboard/settings"
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Approval Delegations</h2>
                    <p className="text-muted-foreground text-sm">
                        Delegate your price approval authority to team members.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">Active Delegations</h3>
                    </div>
                     <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="font-bold">
                                <Plus className="mr-2 h-4 w-4" /> Create Delegation
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <form onSubmit={handleCreateDelegation}>
                                <DialogHeader>
                                    <DialogTitle>Create New Delegation</DialogTitle>
                                    <DialogDescription>
                                        Delegate your approval authority to another team member for a specific period.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 py-4">
                                    <div>
                                        <Label htmlFor="user">Delegate To</Label>
                                        <Select value={selectedUserId} onValueChange={setSelectedUserId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a team member" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {users.map((user) => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name || user.email}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="startDate">Start Date</Label>
                                        <Input
                                            id="startDate"
                                            type="datetime-local"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="endDate">End Date</Label>
                                        <Input
                                            id="endDate"
                                            type="datetime-local"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? 'Creating...' : 'Create Delegation'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

            {delegations.length === 0 ? (
                <Card className="p-8 text-center">
                    <p className="text-gray-600 mb-4">No delegations created yet</p>
                    <p className="text-sm text-gray-500">
                        Create a delegation to allow team members to approve price changes on your behalf
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {delegations.map((delegation) => (
                        <Card key={delegation.id} className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold">
                                            {delegation.fromUser.name || delegation.fromUser.email}
                                            {' → '}
                                            {delegation.toUser.name || delegation.toUser.email}
                                        </h3>
                                        {isActive(delegation) ? (
                                            <Badge variant="default">Active</Badge>
                                        ) : delegation.isActive ? (
                                            <Badge variant="secondary">Scheduled</Badge>
                                        ) : (
                                            <Badge variant="outline">Revoked</Badge>
                                        )}
                                    </div>

                                    <div className="text-sm text-gray-600 space-y-1">
                                        <p>
                                            <span className="font-medium">Period:</span>{' '}
                                            {formatDate(delegation.startDate)} - {formatDate(delegation.endDate)}
                                        </p>
                                        <p>
                                            <span className="font-medium">Created:</span>{' '}
                                            {formatDate(delegation.createdAt)}
                                        </p>
                                    </div>
                                </div>

                                {delegation.isActive && delegation.fromUser.id === session?.user?.id && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRevokeDelegation(delegation.id)}
                                    >
                                        Revoke
                                    </Button>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    </div>
    );
}
