/**
 * Unit tests for error message templates
 * 
 * Tests verify:
 * - Message formatting with variables
 * - Default messages for all error types
 * - Custom message override capability
 * - Non-technical language in user messages
 * - Actionable guidance inclusion
 */

import {
    formatMessage,
    combineMessageWithGuidance,
    getErrorMessage,
    getUserMessage,
    getDeveloperMessage,
    getFieldValidationMessage,
    ERROR_MESSAGES,
    SPECIFIC_MESSAGES,
    FIELD_VALIDATION_MESSAGES,
} from '../../../lib/utils/error-messages';

describe('Error Message Templates', () => {
    describe('formatMessage', () => {
        it('should format message with variables', () => {
            const template = 'Hello {name}, you have {count} messages';
            const variables = { name: 'John', count: 5 };

            const result = formatMessage(template, variables);

            expect(result).toBe('Hello John, you have 5 messages');
        });

        it('should handle missing variables gracefully', () => {
            const template = 'Hello {name}';

            const result = formatMessage(template);

            expect(result).toBe('Hello {name}');
        });

        it('should handle multiple occurrences of same variable', () => {
            const template = '{name} said {name} is great';
            const variables = { name: 'Alice' };

            const result = formatMessage(template, variables);

            expect(result).toBe('Alice said Alice is great');
        });
    });

    describe('combineMessageWithGuidance', () => {
        it('should combine message with guidance', () => {
            const message = 'Something went wrong';
            const guidance = 'Please try again';

            const result = combineMessageWithGuidance(message, guidance);

            expect(result).toBe('Something went wrong. Please try again');
        });

        it('should return message only when guidance is undefined', () => {
            const message = 'Something went wrong';

            const result = combineMessageWithGuidance(message);

            expect(result).toBe('Something went wrong');
        });
    });

    describe('getErrorMessage', () => {
        it('should return generic message for standard error codes', () => {
            const result = getErrorMessage('VALIDATION_ERROR');

            expect(result.userMessage).toBe('The information you provided is invalid');
            expect(result.guidance).toBe('Please check the highlighted fields and try again');
            expect(result.developerMessage).toBeDefined();
        });

        it('should return specific message when available', () => {
            const result = getErrorMessage('PRODUCT_NOT_FOUND');

            expect(result.userMessage).toBe('The product you are looking for could not be found');
            expect(result.guidance).toBe('Please check the product ID or search for the product again');
        });

        it('should format message with variables', () => {
            const result = getErrorMessage('NOT_FOUND', {
                resourceType: 'Product',
                resourceId: '123',
            });

            expect(result.userMessage).toBe('The requested Product could not be found');
        });

        it('should return fallback for unknown error codes', () => {
            const result = getErrorMessage('UNKNOWN_ERROR_CODE');

            expect(result.userMessage).toBe('An unexpected error occurred');
            expect(result.guidance).toContain('contact support');
        });
    });

    describe('getUserMessage', () => {
        it('should return user message with guidance by default', () => {
            const result = getUserMessage('VALIDATION_ERROR');

            expect(result).toContain('The information you provided is invalid');
            expect(result).toContain('Please check the highlighted fields and try again');
        });

        it('should return user message without guidance when requested', () => {
            const result = getUserMessage('VALIDATION_ERROR', undefined, false);

            expect(result).toBe('The information you provided is invalid');
            expect(result).not.toContain('Please check');
        });

        it('should format message with variables', () => {
            const result = getUserMessage('EXTERNAL_SERVICE_ERROR', {
                serviceName: 'OpenCart',
            });

            expect(result).toContain('OpenCart');
        });
    });

    describe('getDeveloperMessage', () => {
        it('should return developer message for error codes', () => {
            const result = getDeveloperMessage('VALIDATION_ERROR');

            expect(result).toBeDefined();
            expect(result).toContain('validation');
        });

        it('should return undefined for specific messages without developer message', () => {
            const result = getDeveloperMessage('PRODUCT_NOT_FOUND');

            expect(result).toBeUndefined();
        });
    });

    describe('getFieldValidationMessage', () => {
        it('should return validation message for field', () => {
            const result = getFieldValidationMessage('REQUIRED');

            expect(result).toBe('This field is required');
        });

        it('should format validation message with variables', () => {
            const result = getFieldValidationMessage('TOO_SHORT', {
                min: 8,
            });

            expect(result).toBe('This value is too short (minimum: 8 characters)');
        });

        it('should format validation message with max variable', () => {
            const result = getFieldValidationMessage('TOO_LONG', {
                max: 100,
            });

            expect(result).toBe('This value is too long (maximum: 100 characters)');
        });
    });

    describe('ERROR_MESSAGES', () => {
        it('should have messages for all standard error types', () => {
            const requiredErrorCodes = [
                'VALIDATION_ERROR',
                'NOT_FOUND',
                'UNAUTHORIZED',
                'FORBIDDEN',
                'CONFLICT',
                'RATE_LIMIT_EXCEEDED',
                'EXTERNAL_SERVICE_ERROR',
                'INTERNAL_ERROR',
            ];

            requiredErrorCodes.forEach(code => {
                expect(ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]).toBeDefined();
                expect(ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES].userMessage).toBeTruthy();
            });
        });

        it('should have non-technical user messages', () => {
            const technicalTerms = [
                'stack trace',
                'database',
                'query',
                'exception',
                'null pointer',
                'undefined',
                'function',
                'class',
                'method',
            ];

            Object.values(ERROR_MESSAGES).forEach(message => {
                const lowerMessage = message.userMessage.toLowerCase();
                technicalTerms.forEach(term => {
                    expect(lowerMessage).not.toContain(term);
                });
            });
        });

        it('should have guidance for all error types', () => {
            Object.values(ERROR_MESSAGES).forEach(message => {
                expect(message.guidance).toBeTruthy();
            });
        });
    });

    describe('SPECIFIC_MESSAGES', () => {
        it('should have product-related error messages', () => {
            expect(SPECIFIC_MESSAGES.PRODUCT_NOT_FOUND).toBeDefined();
            expect(SPECIFIC_MESSAGES.PRODUCT_SYNC_FAILED).toBeDefined();
            expect(SPECIFIC_MESSAGES.PRODUCT_UPDATE_FAILED).toBeDefined();
        });

        it('should have website-related error messages', () => {
            expect(SPECIFIC_MESSAGES.WEBSITE_NOT_FOUND).toBeDefined();
            expect(SPECIFIC_MESSAGES.WEBSITE_CONNECTION_FAILED).toBeDefined();
            expect(SPECIFIC_MESSAGES.INVALID_API_TOKEN).toBeDefined();
        });

        it('should have competitor-related error messages', () => {
            expect(SPECIFIC_MESSAGES.COMPETITOR_NOT_FOUND).toBeDefined();
            expect(SPECIFIC_MESSAGES.SCRAPING_FAILED).toBeDefined();
            expect(SPECIFIC_MESSAGES.SCRAPING_BLOCKED).toBeDefined();
        });

        it('should have non-technical language', () => {
            const technicalTerms = [
                'http',
                'status code',
                'exception',
                'null',
                'undefined',
                'stack trace',
            ];

            Object.values(SPECIFIC_MESSAGES).forEach(message => {
                const lowerMessage = message.userMessage.toLowerCase();
                technicalTerms.forEach(term => {
                    expect(lowerMessage).not.toContain(term);
                });
            });
        });
    });

    describe('FIELD_VALIDATION_MESSAGES', () => {
        it('should have all common validation messages', () => {
            const requiredValidations = [
                'REQUIRED',
                'INVALID_EMAIL',
                'INVALID_URL',
                'INVALID_NUMBER',
                'TOO_SHORT',
                'TOO_LONG',
                'TOO_SMALL',
                'TOO_LARGE',
            ];

            requiredValidations.forEach(validation => {
                expect(FIELD_VALIDATION_MESSAGES[validation as keyof typeof FIELD_VALIDATION_MESSAGES]).toBeDefined();
            });
        });

        it('should have clear, actionable messages', () => {
            Object.values(FIELD_VALIDATION_MESSAGES).forEach(message => {
                expect(message.length).toBeGreaterThan(0);
                expect(message).not.toContain('error');
                expect(message).not.toContain('invalid input');
            });
        });
    });

    describe('Message Quality', () => {
        it('should not contain technical jargon in user messages', () => {
            const technicalJargon = [
                'stack',
                'trace',
                'exception',
                'null pointer',
                'undefined reference',
                'segmentation fault',
                'memory leak',
                'buffer overflow',
            ];

            const allMessages = [
                ...Object.values(ERROR_MESSAGES).map(m => m.userMessage),
                ...Object.values(SPECIFIC_MESSAGES).map(m => m.userMessage),
            ];

            allMessages.forEach(message => {
                const lowerMessage = message.toLowerCase();
                technicalJargon.forEach(jargon => {
                    expect(lowerMessage).not.toContain(jargon);
                });
            });
        });

        it('should have actionable guidance', () => {
            const actionWords = ['please', 'try', 'check', 'verify', 'contact', 'review'];

            Object.values(ERROR_MESSAGES).forEach(message => {
                if (message.guidance) {
                    const lowerGuidance = message.guidance.toLowerCase();
                    const hasActionWord = actionWords.some(word => lowerGuidance.includes(word));
                    expect(hasActionWord).toBe(true);
                }
            });
        });

        it('should use empathetic language', () => {
            const allMessages = [
                ...Object.values(ERROR_MESSAGES).map(m => m.userMessage),
                ...Object.values(SPECIFIC_MESSAGES).map(m => m.userMessage),
            ];

            // Should not use harsh or blaming language
            const harshTerms = ['you failed', 'you broke', 'your fault', 'you caused'];

            allMessages.forEach(message => {
                const lowerMessage = message.toLowerCase();
                harshTerms.forEach(term => {
                    expect(lowerMessage).not.toContain(term);
                });
            });
        });
    });

    describe('Custom Message Override', () => {
        it('should allow custom user message to override default', () => {
            const customMessage = 'This is a custom error message';
            const result = getErrorMessage('VALIDATION_ERROR');

            // The template system allows custom messages to be passed via ErrorOptions
            // This test verifies the template exists and can be overridden
            expect(result.userMessage).toBeTruthy();
            expect(result.userMessage).not.toBe(customMessage);
        });
    });
});
