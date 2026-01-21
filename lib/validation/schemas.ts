import { z } from "zod";

/**
 * Common validation schemas for input sanitization
 * These schemas prevent XSS, SQL injection, and other security vulnerabilities
 */

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

/**
 * Sanitize string to remove dangerous content
 */
function sanitizeString(val: string): string {
  return val
    .replace(/<script[^>]*>.*?<\/script>/gi, "") // Remove script tags
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ""); // Remove event handlers
}

// ============================================================================
// COMMON FIELD VALIDATORS
// ============================================================================

/**
 * Email validation with strict RFC 5322 compliance
 */
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .min(5, "Email must be at least 5 characters")
  .max(255, "Email must not exceed 255 characters")
  .toLowerCase()
  .trim();

/**
 * Password validation with security requirements
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  );

/**
 * URL validation with protocol enforcement
 */
export const urlSchema = z
  .string()
  .url("Invalid URL format")
  .min(10, "URL must be at least 10 characters")
  .max(2048, "URL must not exceed 2048 characters")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: "URL must use HTTP or HTTPS protocol" },
  );

/**
 * Sanitized string - removes HTML tags and dangerous characters
 */
export const sanitizedStringSchema = z
  .string()
  .trim()
  .transform(sanitizeString);

/**
 * Safe text input (alphanumeric + common punctuation)
 */
export const safeTextSchema = z
  .string()
  .trim()
  .min(1, "Field cannot be empty")
  .max(1000, "Field must not exceed 1000 characters")
  .regex(
    /^[a-zA-Z0-9\s\-_.,!?()'"@#$%&*+=:;/\\[\]{}]+$/,
    "Field contains invalid characters",
  );

/**
 * Company/Organization name
 */
export const companyNameSchema = z
  .string()
  .trim()
  .min(2, "Company name must be at least 2 characters")
  .max(100, "Company name must not exceed 100 characters")
  .regex(
    /^[a-zA-Z0-9\s\-_.,&'()]+$/,
    "Company name contains invalid characters",
  );

/**
 * Product SKU
 */
export const skuSchema = z
  .string()
  .trim()
  .min(1, "SKU cannot be empty")
  .max(100, "SKU must not exceed 100 characters")
  .regex(
    /^[a-zA-Z0-9\-_]+$/,
    "SKU can only contain letters, numbers, hyphens, and underscores",
  );

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid("Invalid ID format");

/**
 * Positive number
 */
export const positiveNumberSchema = z
  .number()
  .positive("Value must be positive")
  .finite("Value must be finite");

/**
 * Price validation (allows 0 for "coming soon" products)
 */
export const priceSchema = z
  .number()
  .min(0, "Price cannot be negative")
  .max(999999999.99, "Price exceeds maximum allowed value")
  .finite("Price must be finite");

/**
 * Percentage validation (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, "Percentage cannot be negative")
  .max(100, "Percentage cannot exceed 100")
  .finite("Percentage must be finite");

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  companyName: companyNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"), // Don't validate complexity on login
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

// ============================================================================
// INTEGRATION SCHEMAS
// ============================================================================

export const createIntegrationSchema = z.object({
  platform: z.enum(
    [
      "SHOPIFY",
      "WOOCOMMERCE",
      "OPENCART",
      "LARAVEL",
      "GENERIC",
      "MAGENTO",
      "PRESTASHOP",
      "BIGCOMMERCE",
    ],
    {
      message: "Invalid platform",
    },
  ),
  baseUrl: urlSchema,
  apiToken: z
    .string()
    .trim()
    .min(10, "API token must be at least 10 characters")
    .max(500, "API token is too long")
    .optional(),
  type: z.enum(["USER", "COMPETITOR"]).default("USER"),
});

export const deleteIntegrationSchema = z.object({
  id: uuidSchema,
});

// ============================================================================
// COMPETITOR SCHEMAS
// ============================================================================

export const createCompetitorSchema = z.object({
  url: urlSchema,
});

export const manualMatchSchema = z.object({
  url: urlSchema,
});

export const matchApprovalSchema = z.object({
  matchId: uuidSchema,
  action: z.enum(["APPROVE", "REJECT"]),
});

export const deleteCompetitorSchema = z.object({
  id: uuidSchema,
});

// ============================================================================
// PRODUCT SCHEMAS
// ============================================================================

export const updateProductSchema = z.object({
  id: uuidSchema,
  title: z.string().trim().min(1).max(500).transform(sanitizeString).optional(),
  currentPrice: priceSchema.optional(),
  inStock: z.boolean().optional(),
  stockLevel: z.number().int().min(0).optional(),
  category: z.string().trim().max(100).transform(sanitizeString).optional(),
  brand: z.string().trim().max(100).transform(sanitizeString).optional(),
  model: z.string().trim().max(100).transform(sanitizeString).optional(),
});

export const bulkUpdateProductsSchema = z.object({
  productIds: z
    .array(uuidSchema)
    .min(1, "At least one product ID is required")
    .max(1000, "Cannot update more than 1000 products at once"),
  updates: z.object({
    currentPrice: priceSchema.optional(),
    inStock: z.boolean().optional(),
    category: z.string().trim().max(100).transform(sanitizeString).optional(),
    brand: z.string().trim().max(100).transform(sanitizeString).optional(),
  }),
});

export const bulkPriceUpdateExecutionSchema = z.object({
  product_ids: z
    .array(uuidSchema)
    .min(1, "At least one product ID is required"),
  logic_type: z.enum(["FIXED", "PERCENTAGE"]),
  value: z.number().finite(),
  min_price: z.number().finite().optional(),
});

// ============================================================================
// PRICING RULE SCHEMAS
// ============================================================================

export const createPricingRuleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Rule name must be at least 3 characters")
    .max(100)
    .transform(sanitizeString),
  strategy: z.enum(
    [
      "UNDERCUT",
      "MATCH",
      "MARGIN_LOCK",
      "THRESHOLD",
      "PERCENTAGE",
      "INVENTORY_HIKE",
    ],
    {
      message: "Invalid pricing strategy",
    },
  ),
  parameter: z.number().finite("Parameter must be a valid number"),
  priority: z.number().int().min(1).max(100).default(1),
  isActive: z.boolean().default(true),
  description: z.string().trim().max(500).transform(sanitizeString).optional(),
});

export const updatePricingRuleSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(3).max(100).transform(sanitizeString).optional(),
  strategy: z
    .enum([
      "UNDERCUT",
      "MATCH",
      "MARGIN_LOCK",
      "THRESHOLD",
      "PERCENTAGE",
      "INVENTORY_HIKE",
    ])
    .optional(),
  parameter: z.number().finite().optional(),
  priority: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(500).transform(sanitizeString).optional(),
});

export const deletePricingRuleSchema = z.object({
  id: uuidSchema,
});

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

export const createWebhookSchema = z.object({
  url: urlSchema,
  secret: z.string().trim().max(100).optional(),
  isActive: z.boolean().default(true),
});

export const updateWebhookSchema = z.object({
  id: uuidSchema,
  url: urlSchema.optional(),
  secret: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters")
    .max(100),
  planType: z.enum(["BASIC", "PREMIUM", "PRO"]).default("BASIC"),
  storeLimit: z.number().int().min(1).max(100).default(1),
  competitorLimit: z.number().int().min(1).max(100).default(3),
});

export const updateTenantSchema = z.object({
  id: uuidSchema,
  companyName: z.string().trim().min(2).max(100).optional(),
  storeLimit: z.number().int().min(1).max(100).optional(),
  competitorLimit: z.number().int().min(1).max(100).optional(),
  planType: z.enum(["BASIC", "PREMIUM", "PRO"]).optional(),
});

export const systemConfigSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Key can only contain letters, numbers, and underscores",
    ),
  value: z.string().max(10000),
  description: z.string().trim().max(500).transform(sanitizeString).optional(),
});

export const scraperConfigSchema = z.object({
  proxies: z.array(z.string().trim().min(5)).optional(),
  userAgents: z.array(z.string().trim().min(5)).optional(),
  delay: z
    .object({
      min: z.number().int().min(0),
      max: z.number().int().min(0),
    })
    .refine((data) => data.min <= data.max, {
      message: "Min delay must be less than or equal to max delay",
    })
    .optional(),
  bypasses: z
    .object({
      headless: z.boolean(),
      useStealthPlugin: z.boolean(),
    })
    .optional(),
});

// ============================================================================
// SEARCH & FILTER SCHEMAS
// ============================================================================

export const searchQuerySchema = z.object({
  query: z.string().trim().max(200).transform(sanitizeString).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "name", "price"])
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    { message: "Start date must be before end date" },
  );

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type BulkUpdateProductsInput = z.infer<typeof bulkUpdateProductsSchema>;
export type BulkPriceUpdateExecutionInput = z.infer<
  typeof bulkPriceUpdateExecutionSchema
>;
export type CreatePricingRuleInput = z.infer<typeof createPricingRuleSchema>;
export type UpdatePricingRuleInput = z.infer<typeof updatePricingRuleSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type SystemConfigInput = z.infer<typeof systemConfigSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
