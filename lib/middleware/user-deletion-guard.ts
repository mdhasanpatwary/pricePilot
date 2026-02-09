/**
 * User Deletion Guard Middleware
 * 
 * Prevents accidental user deletion by requiring explicit confirmation.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface UserDeletionConfirmation {
    confirmationPhrase: string;
    userId: string;
    acknowledgeDataLoss: boolean;
    backupConfirmed: boolean;
}

const REQUIRED_CONFIRMATION_PHRASE = 'DELETE USER CONFIRMED';

export function validateUserDeletionRequest(
    body: any
): { valid: boolean; error?: string } {

    if (!body.confirmation) {
        return {
            valid: false,
            error: 'Missing confirmation. User deletion requires explicit confirmation.'
        };
    }

    const confirmation = body.confirmation as UserDeletionConfirmation;

    if (confirmation.confirmationPhrase !== REQUIRED_CONFIRMATION_PHRASE) {
        return {
            valid: false,
            error: `Invalid confirmation phrase. Must type: "${REQUIRED_CONFIRMATION_PHRASE}"`
        };
    }

    if (!confirmation.acknowledgeDataLoss) {
        return {
            valid: false,
            error: 'Must acknowledge that this will permanently delete all data.'
        };
    }

    if (!confirmation.backupConfirmed) {
        return {
            valid: false,
            error: 'Must confirm that a database backup exists.'
        };
    }

    if (!confirmation.userId) {
        return {
            valid: false,
            error: 'User ID must be specified in confirmation.'
        };
    }

    return { valid: true };
}

export async function userDeletionGuard(
    request: NextRequest,
    userId: string
): Promise<NextResponse | null> {

    try {
        const body = await request.json();
        const validation = validateUserDeletionRequest(body);

        if (!validation.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'CONFIRMATION_REQUIRED',
                        message: validation.error,
                        details: {
                            required: {
                                confirmationPhrase: REQUIRED_CONFIRMATION_PHRASE,
                                acknowledgeDataLoss: true,
                                backupConfirmed: true,
                                userId: userId
                            },
                            consequences: [
                                'User account permanently deleted',
                                'All sites deleted (CASCADE)',
                                'All products deleted (CASCADE)',
                                'All data LOST without backup'
                            ]
                        }
                    }
                },
                { status: 403 }
            );
        }

        if (body.confirmation.userId !== userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'USER_ID_MISMATCH',
                        message: 'Confirmation userId does not match.'
                    }
                },
                { status: 400 }
            );
        }

        return null;

    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Invalid request. Confirmation required.'
                }
            },
            { status: 400 }
        );
    }
}
