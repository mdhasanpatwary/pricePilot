# Implementation Plan: API Token Encryption

## Overview

This implementation plan breaks down the API token encryption feature into discrete, incremental coding tasks. The approach follows a bottom-up strategy: build core encryption services first, then integrate with existing services, add migration utilities, and finally implement comprehensive testing. Each task builds on previous work, ensuring no orphaned code and continuous validation through tests.

## Tasks

- [x] 1. Set up encryption infrastructure and key management
  - Create `lib/services/encryption/` directory structure
  - Define TypeScript types and interfaces for encryption service
  - Implement KeyManager class for secure key loading and validation
  - Add environment variable validation on application startup
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ]* 1.1 Write unit tests for KeyManager
  - Test key loading from environment variables
  - Test error handling for missing/invalid keys
  - Test key caching behavior
  - Verify keys never appear in error messages
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. Implement core encryption service
  - [x] 2.1 Create EncryptionService class with encrypt method
    - Implement AES-256-GCM encryption using Node.js crypto module
    - Generate random 12-byte IV for each encryption
    - Return formatted encrypted string: `aes-256-gcm:iv:authTag:ciphertext`
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 2.2 Implement decrypt method in EncryptionService
    - Parse encrypted string format
    - Validate format before decryption attempt
    - Verify authentication tag during decryption
    - Return plaintext or throw appropriate error
    - _Requirements: 1.2, 1.5, 8.3_

  - [x] 2.3 Implement isEncrypted helper method
    - Check if string matches encrypted format pattern
    - Validate base64 encoding of components
    - _Requirements: 8.3, 8.4_

  - [ ]* 2.4 Write property test for encryption round-trip
    - **Property 1: Encryption Round-Trip Consistency**
    - **Validates: Requirements 1.2, 3.2**

  - [ ]* 2.5 Write property test for IV uniqueness
    - **Property 2: IV Uniqueness Ensures Different Ciphertext**
    - **Validates: Requirements 1.3**

  - [ ]* 2.6 Write property test for format structure
    - **Property 3: Encrypted Format Structure**
    - **Validates: Requirements 1.4, 8.1, 8.2, 8.3**

  - [ ]* 2.7 Write property test for authentication tag verification
    - **Property 4: Authentication Tag Verification**
    - **Validates: Requirements 1.5**

  - [ ]* 2.8 Write unit tests for error conditions
    - Test decryption with wrong key
    - Test decryption with corrupted data
    - Test decryption with invalid format
    - Test empty string handling
    - Test very long token handling (1000+ chars)
    - _Requirements: 1.5, 6.2, 8.3_

- [x] 3. Implement custom error classes
  - Create EncryptionError class
  - Create DecryptionError class
  - Create AuthenticationError class (extends DecryptionError)
  - Create InvalidFormatError class
  - Create KeyNotFoundError class
  - Create KeyValidationError class
  - Ensure error messages never expose sensitive data
  - _Requirements: 2.4, 4.4, 6.1, 6.2, 6.5_

- [ ]* 3.1 Write property test for key non-exposure
  - **Property 6: Key Non-Exposure in Errors**
  - **Validates: Requirements 2.4, 5.5**

- [ ]* 3.2 Write property test for token non-exposure
  - **Property 10: Token Non-Exposure in Errors**
  - **Validates: Requirements 4.4**

- [x] 4. Integrate encryption with WebsiteService
  - [x] 4.1 Modify createWebsite method to encrypt tokens
    - Import and inject EncryptionService
    - Encrypt apiToken before database save
    - Wrap in transaction with audit logging
    - Handle encryption errors gracefully
    - _Requirements: 4.2, 6.1_

  - [x] 4.2 Modify updateWebsite method to re-encrypt tokens
    - Check if apiToken is being updated
    - Encrypt new token value before save
    - Maintain transaction integrity
    - _Requirements: 4.2_

  - [x] 4.3 Create getWebsiteWithToken method for decryption
    - Fetch website record from database
    - Detect and migrate plaintext tokens automatically
    - Decrypt token for API usage
    - Cache decrypted token in request scope only
    - _Requirements: 1.2, 3.1, 4.1, 7.1_

  - [x] 4.4 Update syncProducts method to use decrypted tokens
    - Call getWebsiteWithToken instead of direct database fetch
    - Use decrypted token for external API calls
    - Handle decryption errors appropriately
    - _Requirements: 4.1_

  - [ ]* 4.5 Write integration tests for WebsiteService
    - Test website creation with token encryption
    - Test website update with token re-encryption
    - Test product sync with token decryption
    - Test transaction rollback on encryption failure
    - _Requirements: 4.1, 4.2, 6.1_

  - [ ]* 4.6 Write property test for transparent encryption
    - **Property 9: Transparent Encryption on Storage**
    - **Validates: Requirements 4.2**

- [x] 5. Checkpoint - Ensure all tests pass
  - Run all unit tests and property tests
  - Verify encryption/decryption works end-to-end
  - Test with real database (staging environment)
  - Ask the user if questions arise

- [x] 6. Implement audit logging for encryption operations
  - [x] 6.1 Create audit log helper functions
    - logTokenEncrypted(tenantId, userId, websiteId)
    - logTokenDecrypted(tenantId, websiteId, purpose)
    - logTokenMigrated(tenantId, websiteId)
    - logDecryptionFailed(tenantId, websiteId, error)
    - logKeyAccessed(operation)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Integrate audit logging into EncryptionService
    - Log encryption events
    - Log decryption events
    - Log decryption failures
    - Ensure logs never contain plaintext tokens or keys
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 6.3 Integrate audit logging into KeyManager
    - Log key access events
    - Log key validation events
    - _Requirements: 5.4_

  - [ ]* 6.4 Write property test for audit logging
    - **Property 13: Comprehensive Audit Logging**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 7. Implement automatic plaintext token migration
  - [x] 7.1 Add migration logic to getWebsiteWithToken
    - Detect plaintext tokens using isEncrypted()
    - Encrypt plaintext token
    - Update database record in transaction
    - Log migration event
    - Return decrypted token for use
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.2 Add error handling for migration failures
    - Log migration errors
    - Continue operation with plaintext token (backward compatibility)
    - Retry migration on next access
    - _Requirements: 3.4_

  - [ ]* 7.3 Write property test for migration
    - **Property 8: Plaintext Token Migration**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 7.4 Write unit tests for migration error handling
    - Test migration with database errors
    - Test migration with encryption errors
    - Verify system continues with plaintext on failure
    - _Requirements: 3.4_

- [x] 8. Create batch migration utility
  - [x] 8.1 Implement MigrationUtility class
    - Create migrateAllTokens method with batch processing
    - Create migrateToken method for single website
    - Support dry-run mode
    - Support configurable batch size
    - Support continue-on-error option
    - _Requirements: 3.5_

  - [x] 8.2 Implement migration statistics and reporting
    - Track total, migrated, failed, skipped counts
    - Collect detailed error information
    - Generate migration report
    - _Requirements: 3.5_

  - [x] 8.3 Create CLI command for migration
    - Create `npm run migrate-tokens` script
    - Add command-line options (--dry-run, --batch-size)
    - Display progress and results
    - _Requirements: 3.5_

  - [ ]* 8.4 Write unit tests for migration utility
    - Test batch migration with mixed plaintext/encrypted tokens
    - Test dry-run mode
    - Test error handling and continuation
    - Test statistics accuracy
    - _Requirements: 3.5_

- [x] 9. Implement key rotation support
  - [x] 9.1 Extend KeyManager to support multiple keys
    - Add getKey(keyId) method for versioned keys
    - Support ENCRYPTION_MASTER_KEY_NEW environment variable
    - _Requirements: 2.5, 9.1_

  - [x] 9.2 Create KeyRotationUtility class
    - Implement rotateAllTokens method
    - Decrypt with old key, re-encrypt with new key
    - Process in batches
    - Track rotation statistics
    - Log rotation events
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 9.3 Create CLI command for key rotation
    - Create `npm run rotate-keys` script
    - Validate both old and new keys present
    - Display progress and results
    - _Requirements: 9.5_

  - [ ]* 9.4 Write property test for key rotation
    - **Property 7: Key Rotation Round-Trip**
    - **Validates: Requirements 2.5, 9.1, 9.2**

  - [ ]* 9.5 Write unit tests for key rotation utility
    - Test rotation with valid keys
    - Test rotation with missing new key
    - Test error handling during rotation
    - Test statistics accuracy
    - _Requirements: 9.3, 9.4, 9.5_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Run complete test suite (unit + property + integration)
  - Test migration utility with sample data
  - Test key rotation utility with sample data
  - Verify audit logs are created correctly
  - Ask the user if questions arise

- [ ] 11. Add performance optimizations and monitoring
  - [ ] 11.1 Implement request-scoped token caching
    - Cache decrypted tokens in request context
    - Clear cache at end of request
    - Never persist cache beyond request
    - _Requirements: 7.1, 7.2_

  - [ ] 11.2 Add performance monitoring
    - Track encryption operation latency
    - Track decryption operation latency
    - Track migration success/failure rates
    - Add metrics for monitoring dashboard
    - _Requirements: 4.5, 7.4_

  - [ ]* 11.3 Write property test for encryption performance
    - **Property 11: Encryption Performance**
    - **Validates: Requirements 4.5, 7.4**

  - [ ]* 11.4 Write property test for concurrent operations
    - **Property 12: Concurrent Operation Safety**
    - **Validates: Requirements 7.5**

- [ ] 12. Add comprehensive error handling and recovery
  - [ ] 12.1 Implement corrupted token recovery flow
    - Detect authentication errors
    - Mark website status as 'requires_reauth'
    - Send notification to user
    - Clear corrupted token
    - _Requirements: 6.4_

  - [ ] 12.2 Add helpful error messages
    - Create user-friendly error messages for each error type
    - Include guidance for resolution
    - Never expose sensitive data in messages
    - _Requirements: 6.5_

  - [ ]* 12.3 Write property test for helpful error messages
    - **Property 16: Helpful Error Messages**
    - **Validates: Requirements 6.5**

  - [ ]* 12.4 Write unit tests for error recovery flows
    - Test corrupted token recovery
    - Test key unavailability handling
    - Test transaction rollback scenarios
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 13. Add remaining property tests
  - [ ]* 13.1 Write property test for key length validation
    - **Property 5: Key Length Validation**
    - **Validates: Requirements 2.3**

  - [ ]* 13.2 Write property test for format validation
    - **Property 14: Format Validation Before Decryption**
    - **Validates: Requirements 8.3, 8.4**

  - [ ]* 13.3 Write property test for token length constraints
    - **Property 15: Token Length Constraints**
    - **Validates: Requirements 8.5**

- [ ] 14. Create deployment documentation
  - [ ] 14.1 Write deployment guide
    - Document key generation process
    - Document environment variable setup
    - Document migration procedure
    - Document rollback plan
    - _Requirements: All_

  - [ ] 14.2 Create monitoring and alerting guide
    - Document metrics to monitor
    - Document alert thresholds
    - Document troubleshooting procedures
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 14.3 Write key rotation procedure documentation
    - Document step-by-step rotation process
    - Document verification steps
    - Document rollback procedure
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 15. Final checkpoint - Complete validation
  - Run complete test suite with all property tests (100+ iterations each)
  - Verify all 16 correctness properties pass
  - Test end-to-end flows in staging environment
  - Verify audit logging works correctly
  - Test migration utility with production-like data volume
  - Test key rotation utility
  - Review deployment documentation
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- All encryption operations use Node.js built-in crypto module (no external dependencies)
- Migration strategy supports both automatic (lazy) and batch (proactive) approaches
- Key rotation is designed for zero-downtime deployment
