# Implementation Plan: Documentation Content Population

## Overview

This implementation plan creates a content loading system to populate PricePilot's documentation database from markdown files in the `docs-content` directory. The system will read markdown files with YAML frontmatter, validate their structure, and create or update database records using the existing `documentationService`.

## Tasks

- [x] 1. Set up project structure and shared types
  - Create `scripts/lib/documentation-loader/` directory
  - Define TypeScript interfaces for file info, parsed documents, validation results, and loader results
  - Create `types.ts` with all shared type definitions
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Implement file scanner
  - [ ] 2.1 Create `file-scanner.ts` module
    - Implement `scanDirectory()` method to recursively find all `.md` files
    - Extract category and subcategory from directory structure
    - Return array of `FileInfo` objects with path, type, category, subcategory, and filename
    - _Requirements: 1.1, 1.2, 4.1, 4.4_

- [ ] 3. Implement frontmatter parser
  - [ ] 3.1 Create `frontmatter-parser.ts` module
    - Install `gray-matter` package for YAML parsing
    - Implement `parse()` method to extract frontmatter and content from markdown
    - Handle files without frontmatter gracefully
    - Return `ParsedDocument` with frontmatter object and markdown content
    - _Requirements: 1.3, 1.4_

- [ ] 4. Implement slug generator
  - [ ] 4.1 Create `slug-generator.ts` module
    - Implement `generate()` method to create slugs from filenames
    - Remove `.md` extension from filenames
    - Preserve kebab-case formatting
    - Sanitize any special characters
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5. Implement frontmatter validator
  - [ ] 5.1 Create `validator.ts` module
    - Implement `validate()` method that checks all validation rules
    - Validate required fields exist (title, category, tags, lastReviewed)
    - Validate field types (title is string, tags is array, etc.)
    - Validate category matches directory structure
    - Validate lastReviewed is valid ISO date format (YYYY-MM-DD)
    - Return `ValidationResult` with isValid flag and array of errors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

- [ ] 6. Implement database writer
  - [ ] 6.1 Create `database-writer.ts` module
    - Implement `writeDocument()` method
    - Check if document exists using `documentationService.getDocument()`
    - Create new document using `documentationService.createDocument()` if not exists
    - Update existing document using `documentationService.updateDocument()` if exists
    - Map frontmatter fields to document metadata structure
    - Handle database errors gracefully
    - Return `WriteResult` with action (created/updated/skipped) and optional error
    - Support dry-run mode that skips actual database operations
    - _Requirements: 1.5, 1.6, 5.1, 5.2, 5.3, 8.1_

- [ ] 7. Implement main loader script
  - [ ] 7.1 Create `scripts/seed-documentation.ts` main script
    - Parse command-line arguments (--dry-run, --verify, --verbose)
    - Initialize all loader components (scanner, parser, validator, writer)
    - Scan both tenant and admin directories
    - Process each file: read → parse → validate → generate slug → write
    - Track statistics (total, created, updated, skipped, errors)
    - Handle errors gracefully and continue processing
    - Generate summary report at the end
    - Exit with appropriate status code
    - _Requirements: 1.7, 1.8, 7.4, 7.6_

- [ ] 8. Implement progress reporting
  - [ ] 8.1 Add progress logging to main script
    - Log total file count at start
    - Log progress every 10 files or 10% completion
    - Display progress indicator with percentage
    - Log each filename as it's being processed
    - Display total execution time at completion
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 9. Implement error handling and reporting
  - [ ] 9.1 Add comprehensive error handling
    - Catch and log file read errors with filename
    - Catch and log frontmatter parse errors with filename
    - Catch and log validation errors with filename and details
    - Catch and log database errors with filename
    - Collect all errors in array
    - Display error summary at end with counts by type
    - Ensure script continues after individual file errors
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [ ] 10. Implement slug uniqueness checking
  - [ ] 10.1 Add duplicate slug detection
    - Track all generated slugs in a Set per documentation type
    - Check for duplicates before processing each file
    - Log error and skip file if duplicate slug detected
    - Include duplicate information in error summary
    - _Requirements: 3.4, 3.5_

- [ ] 11. Implement idempotency features
  - [ ] 11.1 Add update vs create logic
    - Check if document exists before creating
    - Update existing documents instead of creating duplicates
    - Preserve document IDs during updates
    - Log whether each document was created or updated
    - Include created/updated counts in summary
    - _Requirements: 5.4, 5.5_

- [ ] 12. Implement dry-run mode
  - [ ] 12.1 Add dry-run functionality
    - Display clear indicator when in dry-run mode
    - Skip all database write operations in dry-run mode
    - Still perform all validation and logging
    - Log all documents that would be created or updated
    - Report all errors that would occur
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [ ] 13. Implement verification mode
  - [ ] 13.1 Add verification functionality
    - Add `--verify` command-line flag
    - Query all documents from database by type
    - Compare database documents with source files
    - Report missing documents (in files but not in database)
    - Report mismatched content (different content between file and database)
    - Display verification summary
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 14. Add documentation and usage instructions
  - [ ] 14.1 Create README for the loader
    - Document command-line usage
    - Provide examples for common scenarios
    - Explain frontmatter requirements
    - Document error messages and troubleshooting
    - Add section to main project README about seeding documentation
    - _Requirements: All_

- [ ] 15. Checkpoint - Manual testing and verification
  - Run script with `--dry-run` to verify file detection and validation
  - Run script on development database to populate documentation
  - Verify documents appear at `/docs/getting-started` and other routes
  - Test idempotency by running script twice
  - Test error handling with intentionally invalid files
  - Run verification mode to confirm database matches source files
  - Check all categories are populated correctly
  - Verify metadata fields are correctly mapped
  - Test with `--verbose` flag for detailed output
  - Confirm exit codes are correct for success and error cases

## Notes

- This project follows a test-free development policy, so no automated tests will be created
- Validation will be performed through manual testing and dry-run mode
- The script should be idempotent and safe to run multiple times
- All database operations use the existing `documentationService` for consistency
- Error handling ensures the script continues processing even if individual files fail
- Progress reporting provides visibility during execution
- Dry-run and verification modes enable safe testing before actual database modifications
