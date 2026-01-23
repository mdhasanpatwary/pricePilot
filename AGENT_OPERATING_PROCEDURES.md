# PricePilot Agent Operating Procedures

This document outlines the rules and conventions that every AI Agent working on the PricePilot codebase MUST follow to maintain consistency, security, and performance.

## 1. Safety & Commits
- **Pre-Commit Checks**: Every commit must pass `yarn lint`, `yarn test`, and `yarn build`. 
- **Husky Integration**: Do not bypass Husky hooks. If a build fails, fix the code before committing.
- **Database Migrations**: Always run `npx prisma db push` or `npx prisma migrate dev` after changing the schema. Verify database connectivity before proceeding.

## 2. Code Quality & Standards
- **Validation**: Every API input MUST be validated using **Zod**. Schemas are located in `lib/validation/schemas.ts`.
- **Sanitization**: String inputs must be sanitized using `sanitizedStringSchema` to prevent XSS.
- **UI/UX**: 
  - Use `lucide-react` for icons.
  - Use `sonner` for toast notifications.
  - Maintain the "Rich Aesthetics" directive: vibrant colors, smooth transitions, and premium dark/light mode support.
- **Components**: Prefer reusable components in `components/ui` (Radix UI based) or shared logic.

## 3. Background Processing (BullMQ)
- **Long-running tasks**: Scrapers, large imports, and heavy data processing MUST run in background workers via BullMQ.
- **Queue Access**: Use `getSyncQueue()` or `getNotificationQueue()` from `lib/queue/client.ts`. Do not instantiate queues directly.
- **Worker Status**: When building features that use workers, ensure they provide real-time feedback (e.g., updating site `isSyncing`, `syncProcessed`, `syncTotal` fields).

## 4. Error Handling & Logging
- **User Feedback**: Always provide clear error messages via toast notifications or UI alert states.
- **System Logs**: Use `SyncLog` (for synchronization events) and `TenantAuditLog` (for administrative actions) to record system activity.
- **Transactional Safety**: Use Prisma Transactions (`prisma.$transaction`) for operations that modify multiple related records to prevent data corruption.

## 5. Directory Structure
- `app/api/v1/...`: REST API endpoints.
- `app/admin/...`: Super Admin management interface.
- `app/dashboard/...`: Tenant-specific dashboard features.
- `lib/services/...`: Core business logic and external integrations.
- `lib/queue/...`: Worker and Queue definitions.

## 6. Integration Rules
- **Versioning**: Always check version compatibility for external platforms (e.g., OpenCart 3.x/4.x).
- **Graceful Failure**: If an external API returns HTML (error pages) instead of JSON, catch it and log a meaningful error. Use the JSON extraction logic in `SyncService` if responses are malformed.

## 7. Must Do
_ feature implement korar somoy always keep in mind existing features jeno break na hoy.
_ after implement any feature, always run `yarn lint`, `yarn test`, and `yarn build`. if any error found, fix it before commit. then commit and push to the repository.

---
*Following these rules ensures that PricePilot remains the most reliable and premium pricing automation platform.*
