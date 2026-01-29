import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

/**
 * Validation middleware for API routes
 * Validates request body, query params, and path params against Zod schemas
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>,
): Promise<ValidationResult<T>> {
  try {
    const body = await req.json();
    const validatedData = schema.parse(body);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: "Validation failed",
        errors: error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      };
    }
    return {
      success: false,
      error: "Invalid request body",
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>,
): ValidationResult<T> {
  try {
    const { searchParams } = new URL(req.url);
    const queryObject: Record<string, string | string[]> = {};

    searchParams.forEach((value, key) => {
      const existing = queryObject[key];
      if (existing) {
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          queryObject[key] = [existing, value];
        }
      } else {
        queryObject[key] = value;
      }
    });

    const validatedData = schema.parse(queryObject);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: "Validation failed",
        errors: error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      };
    }
    return {
      success: false,
      error: "Invalid query parameters",
    };
  }
}

/**
 * Validate path parameters against a Zod schema
 */
export function validateParams<T>(
  params: Record<string, string>,
  schema: z.ZodSchema<T>,
): ValidationResult<T> {
  try {
    const validatedData = schema.parse(params);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: "Validation failed",
        errors: error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      };
    }
    return {
      success: false,
      error: "Invalid path parameters",
    };
  }
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(
  result: ValidationResult<unknown>,
): NextResponse {
  return NextResponse.json(
    {
      error: result.error || "Validation failed",
      details: result.errors,
    },
    { status: 400 },
  );
}

/**
 * Higher-order function to wrap API handlers with validation
 * Usage:
 *
 * export const POST = withValidation(
 *   registerSchema,
 *   async (req, validatedData) => {
 *     // validatedData is type-safe and validated
 *     return NextResponse.json({ success: true });
 *   }
 * );
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, validatedData: T) => Promise<NextResponse>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const result = await validateBody(req, schema);

    if (!result.success) {
      return validationErrorResponse(result);
    }

    return handler(req, result.data!);
  };
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Uses DOMPurify for comprehensive XSS prevention
 */
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(input: string, allowBasicFormatting: boolean = false): string {
  if (allowBasicFormatting) {
    // Allow basic formatting tags for rich text content
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
    });
  }

  // Strip all HTML tags for plain text fields
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }).trim();
}

/**
 * Sanitize SQL to prevent SQL injection
 * This is a basic sanitizer - Prisma already handles parameterized queries
 * Use this for raw SQL queries only
 */
export function sanitizeSql(input: string): string {
  return input
    .replace(/['";\\]/g, "") // Remove SQL special characters
    .replace(/--/g, "") // Remove SQL comments
    .replace(/\/\*/g, "") // Remove block comment start
    .replace(/\*\//g, "") // Remove block comment end
    .replace(/xp_/gi, "") // Remove extended stored procedures
    .replace(/sp_/gi, "") // Remove stored procedures
    .replace(/exec(\s|\+)+(s|x)p\w+/gi, "") // Remove exec commands
    .trim();
}

/**
 * Validate and sanitize file upload
 */
export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {},
): ValidationResult<File> {
  const {
    maxSizeBytes = 5 * 1024 * 1024, // 5MB default
    allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  } = options;

  // Check file size
  if (file.size > maxSizeBytes) {
    return {
      success: false,
      error: `File size exceeds maximum allowed size of ${maxSizeBytes / 1024 / 1024}MB`,
    };
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      success: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedMimeTypes.join(", ")}`,
    };
  }

  // Check file extension
  const extension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf("."));
  if (!allowedExtensions.includes(extension)) {
    return {
      success: false,
      error: `File extension ${extension} is not allowed. Allowed extensions: ${allowedExtensions.join(", ")}`,
    };
  }

  return {
    success: true,
    data: file,
  };
}

/**
 * Rate limit validation helper
 * Checks if a value exceeds a threshold
 */
export function validateRateLimit(
  current: number,
  limit: number,
  resource: string,
): ValidationResult<number> {
  if (current >= limit) {
    return {
      success: false,
      error: `${resource} limit exceeded. Current: ${current}, Limit: ${limit}`,
    };
  }

  return {
    success: true,
    data: current,
  };
}

/**
 * Validate IP address format
 */
export function validateIpAddress(ip: string): ValidationResult<string> {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
    return {
      success: false,
      error: "Invalid IP address format",
    };
  }

  // Validate IPv4 octets
  if (ipv4Regex.test(ip)) {
    const octets = ip.split(".");
    for (const octet of octets) {
      const num = parseInt(octet, 10);
      if (num < 0 || num > 255) {
        return {
          success: false,
          error: "Invalid IPv4 address",
        };
      }
    }
  }

  return {
    success: true,
    data: ip,
  };
}

/**
 * Validate JSON string
 */
export function validateJson(input: string): ValidationResult<unknown> {
  try {
    const parsed = JSON.parse(input);
    return {
      success: true,
      data: parsed,
    };
  } catch {
    return {
      success: false,
      error: "Invalid JSON format",
    };
  }
}

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: Date,
  endDate: Date,
): ValidationResult<{ startDate: Date; endDate: Date }> {
  if (startDate > endDate) {
    return {
      success: false,
      error: "Start date must be before end date",
    };
  }

  const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (endDate.getTime() - startDate.getTime() > maxRange) {
    return {
      success: false,
      error: "Date range cannot exceed 1 year",
    };
  }

  return {
    success: true,
    data: { startDate, endDate },
  };
}
