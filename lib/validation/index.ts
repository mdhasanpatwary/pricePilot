/**
 * Input Validation & Sanitization Module
 *
 * This module provides comprehensive input validation and sanitization
 * to prevent XSS, SQL injection, and other security vulnerabilities.
 *
 * Usage:
 *
 * ```typescript
 * import { validateBody, registerSchema } from '@/lib/validation';
 *
 * export async function POST(req: NextRequest) {
 *   const result = await validateBody(req, registerSchema);
 *
 *   if (!result.success) {
 *     return validationErrorResponse(result);
 *   }
 *
 *   // result.data is type-safe and validated
 *   const { email, password, companyName } = result.data;
 * }
 * ```
 */

// Export all schemas
export * from "./schemas";

// Export validation middleware
export * from "./middleware";
