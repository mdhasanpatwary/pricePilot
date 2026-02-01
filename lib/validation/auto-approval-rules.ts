import { z } from "zod";

/**
 * Auto-Approval Rules Validation Schemas
 * 
 * These schemas validate auto-approval rule configurations for the price approval workflow.
 * They ensure rules are properly structured and prevent invalid configurations that could
 * cause unintended price changes.
 * 
 * Requirements: 2.7, 9.1, 9.2, 9.3, 9.4, 9.5
 */

// ============================================================================
// RULE CONDITIONS SCHEMA
// ============================================================================

/**
 * Price range condition for filtering products by price
 */
const priceRangeSchema = z
    .object({
        min: z
            .number()
            .min(0, "Minimum price cannot be negative")
            .finite("Minimum price must be finite"),
        max: z
            .number()
            .min(0, "Maximum price cannot be negative")
            .finite("Maximum price must be finite"),
    })
    .refine((data) => data.min < data.max, {
        message: "Minimum price must be less than maximum price",
        path: ["min"],
    });

/**
 * Rule conditions schema with all optional fields
 * At least one condition must be specified to prevent rules that auto-approve everything
 */
export const RuleConditionsSchema = z
    .object({
        // Maximum absolute price change in currency units (e.g., $50.00)
        maxPriceChange: z
            .number()
            .positive("Maximum price change must be positive")
            .finite("Maximum price change must be finite")
            .optional(),

        // Maximum percentage change (0-100)
        maxPercentageChange: z
            .number()
            .min(0, "Maximum percentage change cannot be negative")
            .max(100, "Maximum percentage change cannot exceed 100")
            .finite("Maximum percentage change must be finite")
            .optional(),

        // Minimum match confidence score (0-100)
        minConfidenceScore: z
            .number()
            .min(0, "Minimum confidence score cannot be negative")
            .max(100, "Minimum confidence score cannot exceed 100")
            .finite("Minimum confidence score must be finite")
            .optional(),

        // Allowed pricing strategies (e.g., ["UNDERCUT", "MATCH"])
        allowedStrategies: z
            .array(
                z.enum(
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
                    }
                )
            )
            .min(1, "At least one strategy must be specified")
            .optional(),

        // Product categories for filtering (e.g., ["Electronics", "Computers"])
        productCategories: z
            .array(
                z
                    .string()
                    .trim()
                    .min(1, "Category name cannot be empty")
                    .max(100, "Category name must not exceed 100 characters")
            )
            .min(1, "At least one category must be specified")
            .optional(),

        // Price range for filtering products
        priceRange: priceRangeSchema.optional(),
    })
    .refine(
        (data) => {
            // At least one condition must be specified
            return (
                data.maxPriceChange !== undefined ||
                data.maxPercentageChange !== undefined ||
                data.minConfidenceScore !== undefined ||
                data.allowedStrategies !== undefined ||
                data.productCategories !== undefined ||
                data.priceRange !== undefined
            );
        },
        {
            message: "At least one condition must be specified",
            path: ["conditions"],
        }
    );

// ============================================================================
// CREATE AUTO-APPROVAL RULE SCHEMA
// ============================================================================

/**
 * Schema for creating a new auto-approval rule
 * All fields are required except description
 */
export const CreateAutoApprovalRuleSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, "Rule name must be at least 3 characters")
        .max(100, "Rule name must not exceed 100 characters"),

    description: z
        .string()
        .trim()
        .max(500, "Description must not exceed 500 characters")
        .optional(),

    enabled: z.boolean(),

    priority: z
        .number()
        .int("Priority must be an integer")
        .min(1, "Priority must be at least 1")
        .max(1000, "Priority must not exceed 1000"),

    conditions: RuleConditionsSchema,
});

// ============================================================================
// UPDATE AUTO-APPROVAL RULE SCHEMA
// ============================================================================

/**
 * Schema for updating an existing auto-approval rule
 * All fields are optional to allow partial updates
 */
export const UpdateAutoApprovalRuleSchema = z.object({
    name: z
        .string()
        .trim()
        .min(3, "Rule name must be at least 3 characters")
        .max(100, "Rule name must not exceed 100 characters")
        .optional(),

    description: z
        .string()
        .trim()
        .max(500, "Description must not exceed 500 characters")
        .optional()
        .nullable(),

    enabled: z.boolean().optional(),

    priority: z
        .number()
        .int("Priority must be an integer")
        .min(1, "Priority must be at least 1")
        .max(1000, "Priority must not exceed 1000")
        .optional(),

    conditions: RuleConditionsSchema.optional(),
});

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type RuleConditions = z.infer<typeof RuleConditionsSchema>;
export type CreateAutoApprovalRuleInput = z.infer<
    typeof CreateAutoApprovalRuleSchema
>;
export type UpdateAutoApprovalRuleInput = z.infer<
    typeof UpdateAutoApprovalRuleSchema
>;
