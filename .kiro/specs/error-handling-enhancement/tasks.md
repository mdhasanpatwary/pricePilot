# Implementation Plan: Error Handling Enhancement

## Overview

This implementation plan establishes a comprehensive error handling system for PricePilot. The approach follows a bottom-up strategy: first building the core error infrastructure (classes, sanitizer, logger), then integrating with the API layer (middleware), and finally updating all service layers to use the new system. Each step includes property-based tests to validate correctness properties from the design.

## Tasks

- [x] 1. Create core error class hierarchy
  - [x] 1.1 Create lib/utils/error-handler.ts with base AppError class
    - Implement AppError extending Error with statusCode, errorCode, userMessage, context, cause
    - Implement toJSON() for API responses
    - Implement toLogFormat() for logging
    - Add isRetryable and retryAfter properties
    - _Requirements: 1.1, 1.9, 1.10, 2.1-2.8_
  
  - [ ]* 1.2 Write property test for error context preservation
    - **Property 1: Error Context Preservation**
    - **Validates: Requirements 1.9, 2.1-2.8**
  
  - [ ]* 1.3 Write property test for status code mapping
    - **Property 2: Error Type to Status Code Mapping**
    - **Validates: Requirements 1.10, 7.2**
  
  - [x] 1.4 Create specialized error classes
    - Implement ValidationError with fields property
    - Implement NotFoundError with resourceType and resourceId
    - Implement UnauthorizedError
    - Implement ForbiddenError with requiredPermission
    - Implement ConflictError with conflictingResource
    - Implement RateLimitError with limit and windowSeconds
    - Implement ExternalServiceError with serviceName and serviceStatusCode
    - _Requirements: 1.2-1.8_
  
  - [ ]* 1.5 Write unit tests for specialized error classes
    - Test each error class constructor
    - Test default values and inheritance
    - Test toJSON() serialization
    - _Requirements: 1.2-1.8_
  
  - [ ]* 1.6 Write property test for ValidationError field details
    - **Property 7: ValidationError Field Details**
    - **Validates: Requirements 3.7**

- [x] 2. Implement error sanitization system
  - [x] 2.1 Create lib/utils/error-sanitizer.ts
    - Implement ErrorSanitizer class
    - Define default sensitive patterns (tokens, passwords, credentials, connection strings)
    - Implement sanitizeMessage() method
    - Implement sanitizeContext() method
    - Implement sanitizeError() method
    - Implement isSensitiveField() method
    - _Requirements: 4.1-4.5_
  
  - [ ]* 2.2 Write property test for sensitive data sanitization
    - **Property 3: Sensitive Data Sanitization**
    - **Validates: Requirements 3.3, 4.1-4.4**
  
  - [ ]* 2.3 Write property test for user message non-technical content
    - **Property 4: User Message Non-Technical**
    - **Validates: Requirements 3.1, 3.4**
  
  - [ ]* 2.4 Write unit tests for specific sanitization patterns
    - Test API token patterns (Bearer, sk_, pk_)
    - Test password field redaction
    - Test connection string redaction
    - Test nested object sanitization
    - _Requirements: 4.1-4.4_

- [x] 3. Implement error logging system
  - [x] 3.1 Create lib/utils/error-logger.ts
    - Implement ErrorLogger class
    - Integrate with existing lib/logger.ts
    - Implement logError() method
    - Implement getLogLevel() for severity mapping
    - Implement formatLogEntry() for structured logging
    - _Requirements: 5.1-5.10_
  
  - [ ]* 3.2 Write property test for log entry completeness
    - **Property 10: Log Entry Completeness**
    - **Validates: Requirements 5.1-5.6**
  
  - [ ]* 3.3 Write property test for error type to log level mapping
    - **Property 11: Error Type to Log Level Mapping**
    - **Validates: Requirements 5.7**
  
  - [ ]* 3.4 Write property test for original error preservation
    - **Property 12: Original Error Preservation**
    - **Validates: Requirements 5.10, 6.9**
  
  - [ ]* 3.5 Write unit tests for logger integration
    - Test ERROR level for critical errors
    - Test WARN level for user errors
    - Test integration with lib/logger.ts
    - _Requirements: 5.7, 5.8, 5.9_

- [x] 4. Checkpoint - Ensure core infrastructure tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create global error handler middleware
  - [x] 5.1 Create lib/middleware/global-error-handler.ts
    - Implement GlobalErrorHandler class
    - Implement handleError() middleware function
    - Implement toErrorResponse() for API response formatting
    - Implement wrapError() for non-AppError errors
    - Support development vs production mode
    - _Requirements: 7.1-7.12_
  
  - [ ]* 5.2 Write property test for standardized error response format
    - **Property 15: Standardized Error Response Format**
    - **Validates: Requirements 7.1**
  
  - [ ]* 5.3 Write property test for environment-based developer messages
    - **Property 8: Environment-Based Developer Message Inclusion**
    - **Validates: Requirements 4.6, 4.7**
  
  - [ ]* 5.4 Write property test for unique error codes
    - **Property 16: Unique Error Codes**
    - **Validates: Requirements 7.10**
  
  - [ ]* 5.5 Write property test for request ID in responses
    - **Property 17: Request ID in Error Responses**
    - **Validates: Requirements 7.11**
  
  - [ ]* 5.6 Write property test for error logging before response
    - **Property 18: Error Logging Before Response**
    - **Validates: Requirements 7.12**
  
  - [ ]* 5.7 Write unit tests for HTTP status code mapping
    - Test ValidationError → 422
    - Test NotFoundError → 404
    - Test UnauthorizedError → 401
    - Test ForbiddenError → 403
    - Test ConflictError → 409
    - Test RateLimitError → 429
    - Test ExternalServiceError → 502
    - Test generic AppError → 500
    - _Requirements: 7.3-7.9_

- [x] 6. Integrate error handling with SyncService
  - [x] 6.1 Update lib/services/sync.ts with error handling
    - Wrap all operations in try-catch blocks
    - Throw ValidationError for invalid input
    - Throw NotFoundError for missing resources
    - Throw ExternalServiceError for API failures
    - Include operation name in error context
    - Preserve original errors as cause
    - _Requirements: 6.1, 6.5, 6.6, 6.7, 6.8, 6.9_
  
  - [ ]* 6.2 Write property test for service error type consistency
    - **Property 13: Service Error Type Consistency**
    - **Validates: Requirements 6.1-6.4**
  
  - [ ]* 6.3 Write property test for service operation context
    - **Property 14: Service Operation Context**
    - **Validates: Requirements 6.8**
  
  - [ ]* 6.4 Write unit tests for SyncService error scenarios
    - Test missing websiteId throws ValidationError
    - Test missing website throws NotFoundError
    - Test API failure throws ExternalServiceError
    - _Requirements: 6.5, 6.6, 6.7_

- [x] 7. Integrate error handling with ScraperService
  - [x] 7.1 Update lib/services/scraper.ts with error handling
    - Wrap scraping operations in try-catch blocks
    - Throw ExternalServiceError for network failures
    - Throw RateLimitError for rate limiting
    - Maintain compatibility with existing ScrapeBlockError
    - Include operation name and competitor URL in context
    - Mark transient errors as retryable
    - _Requirements: 6.2, 6.5, 6.8, 6.9, 8.3, 9.1, 9.2_
  
  - [ ]* 7.2 Write unit tests for ScraperService error scenarios
    - Test network timeout throws ExternalServiceError with isRetryable=true
    - Test rate limiting throws RateLimitError
    - Test ScrapeBlockError compatibility
    - _Requirements: 6.5, 8.3, 9.1_

- [x] 8. Integrate error handling with RulesEngine
  - [x] 8.1 Update lib/services/rules-engine.ts with error handling
    - Wrap rule evaluation in try-catch blocks
    - Throw ValidationError for invalid rule configuration
    - Throw NotFoundError for missing products
    - Include operation name and rule ID in context
    - _Requirements: 6.3, 6.6, 6.7, 6.8, 6.9_
  
  - [ ]* 8.2 Write unit tests for RulesEngine error scenarios
    - Test invalid rule throws ValidationError
    - Test missing product throws NotFoundError
    - _Requirements: 6.6, 6.7_

- [x] 9. Integrate error handling with MatchingService
  - [x] 9.1 Update lib/services/matching.ts with error handling
    - Wrap matching operations in try-catch blocks
    - Throw ValidationError for invalid matching criteria
    - Throw NotFoundError for missing products
    - Include operation name and product IDs in context
    - _Requirements: 6.4, 6.6, 6.7, 6.8, 6.9_
  
  - [ ]* 9.2 Write unit tests for MatchingService error scenarios
    - Test invalid criteria throws ValidationError
    - Test missing product throws NotFoundError
    - _Requirements: 6.6, 6.7_

- [x] 10. Checkpoint - Ensure service integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement backward compatibility layer
  - [x] 11.1 Create adapters for existing error classes
    - Create adapter for EncryptionError in lib/services/encryption/errors.ts
    - Create adapter for DecryptionError
    - Create adapter for ScrapeBlockError
    - Update withErrorHandling wrapper in lib/error-api.ts
    - _Requirements: 8.1-8.5_
  
  - [ ]* 11.2 Write property test for backward compatibility
    - **Property 19: Backward Compatibility with Existing Errors**
    - **Validates: Requirements 8.1-8.5**
  
  - [ ]* 11.3 Write unit tests for error adapters
    - Test EncryptionError is wrapped correctly
    - Test DecryptionError is wrapped correctly
    - Test ScrapeBlockError is wrapped correctly
    - Test enhanced withErrorHandling wrapper
    - _Requirements: 8.1-8.5_

- [x] 12. Implement retry logic metadata
  - [x] 12.1 Add retry metadata to error classes
    - Update ExternalServiceError to mark transient failures as retryable
    - Update RateLimitError with retry delay
    - Add isRetryable flag to all error types
    - Add retryAfter property for retry delays
    - _Requirements: 9.1-9.6_
  
  - [ ]* 12.2 Write property test for retry metadata consistency
    - **Property 20: Retry Metadata Consistency**
    - **Validates: Requirements 9.1-9.6**
  
  - [ ]* 12.3 Write unit tests for retry logic
    - Test ExternalServiceError with transient failure is retryable
    - Test RateLimitError includes retry delay
    - Test non-retryable errors have isRetryable=false
    - _Requirements: 9.1-9.6_

- [x] 13. Add user-friendly error messages
  - [x] 13.1 Create error message templates
    - Define default user messages for all error types
    - Create message formatting utilities
    - Add actionable guidance where applicable
    - Ensure no technical jargon in user messages
    - _Requirements: 3.1, 3.2, 3.5, 3.6_
  
  - [ ]* 13.2 Write property test for default user messages
    - **Property 5: Default User Messages**
    - **Validates: Requirements 3.5**
  
  - [ ]* 13.3 Write property test for custom user message override
    - **Property 6: Custom User Message Override**
    - **Validates: Requirements 3.6**
  
  - [ ]* 13.4 Write unit tests for message templates
    - Test each error type has a default message
    - Test custom messages override defaults
    - Test messages are non-technical
    - _Requirements: 3.1, 3.5, 3.6_

- [x] 14. Implement security error audit logging
  - [x] 14.1 Add audit trail markers for security errors
    - Update ErrorLogger to detect security errors
    - Log UnauthorizedError to audit trail
    - Log ForbiddenError to audit trail
    - Include IP address and user agent in audit logs
    - _Requirements: 4.8_
  
  - [ ]* 14.2 Write property test for security error audit logging
    - **Property 9: Security Error Audit Logging**
    - **Validates: Requirements 4.8**
  
  - [ ]* 14.3 Write unit tests for audit logging
    - Test UnauthorizedError triggers audit log
    - Test ForbiddenError triggers audit log
    - Test audit log includes IP and user agent
    - _Requirements: 4.8_

- [x] 15. Update API endpoints to use global error handler
  - [x] 15.1 Register global error handler middleware
    - Add GlobalErrorHandler to Next.js API middleware chain
    - Configure development vs production mode
    - Ensure all API routes use the middleware
    - Test error responses from actual endpoints
    - _Requirements: 7.1-7.12_
  
  - [ ]* 15.2 Write integration tests for API error responses
    - Test validation errors return 422 with field details
    - Test not found errors return 404
    - Test unauthorized errors return 401
    - Test error responses include requestId
    - Test sensitive data is not exposed
    - _Requirements: 7.1-7.12_

- [x] 16. Final checkpoint - Comprehensive testing
  - [x] 16.1 Run all unit tests
    - Verify all unit tests pass
    - Check code coverage > 90%
  
  - [x] 16.2 Run all property-based tests
    - Verify all property tests pass with 100 iterations
    - Review any shrunk failing cases
  
  - [x] 16.3 Run integration tests
    - Test error handling across all services
    - Test API error responses
    - Test backward compatibility
  
  - [x] 16.4 Manual testing
    - Test error messages in UI
    - Verify no sensitive data exposed
    - Check logs for proper formatting
    - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Documentation and cleanup
  - [x] 17.1 Create error handling documentation
    - Document error class hierarchy
    - Document how to use error classes in services
    - Document error response format
    - Add examples for common scenarios
    - _Requirements: All_
  
  - [x] 17.2 Update existing service documentation
    - Update SyncService docs with error handling
    - Update ScraperService docs with error handling
    - Update RulesEngine docs with error handling
    - Update MatchingService docs with error handling
  
  - [x] 17.3 Clean up deprecated error handling code
    - Remove old error handling patterns (if any)
    - Update imports across codebase
    - Ensure backward compatibility maintained

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100 iterations
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: core infrastructure → middleware → service integration
- Backward compatibility is maintained throughout to allow gradual migration
- Security is prioritized with automatic sanitization and audit logging
