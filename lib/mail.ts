import { NotificationSender } from "./services/notification-sender";

/**
 * Email service for PricePilot
 * Uses SystemConfig credentials managed by Super Admin
 */
export const mailService = {
  /**
   * Send verification email
   */
  sendVerificationEmail: async (email: string, token: string) => {
    const verificationUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/verify?token=${token}`;

    const html = `
      <h2>Welcome to PricePilot</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `;

    return NotificationSender.sendEmail(
      email,
      "Verify your PricePilot account",
      html,
    );
  },

  /**
   * Send password reset email
   */
  sendPasswordResetEmail: async (email: string, token: string) => {
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`;

    const html = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your PricePilot account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in 1 hour. If you didn't request this, please contact support.</p>
    `;

    return NotificationSender.sendEmail(
      email,
      "Reset your PricePilot password",
      html,
    );
  },

  /**
   * Send auto-approval notification email
   * 
   * Sends a batched email notification to users with email notifications enabled
   * when price changes are auto-approved.
   * 
   * @param tenantId - The tenant ID to send notifications for
   * @param approvedCount - Number of price changes auto-approved
   * @param ruleNames - Array of rule names that triggered approvals
   * 
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  sendAutoApprovalNotification: async (
    tenantId: string,
    approvedCount: number,
    ruleNames: string[]
  ): Promise<void> => {
    try {
      // Load users with emailNotifications=true for tenant (Requirement 7.5)
      const users = await import("@/lib/prisma").then((m) => m.prisma.user.findMany({
        where: {
          tenantId,
          emailNotifications: true,
        },
        select: {
          email: true,
          name: true,
        },
      }));

      // If no users with notifications enabled, return early
      if (users.length === 0) {
        return;
      }

      // Get unique rule names for display
      const uniqueRuleNames = Array.from(new Set(ruleNames));

      // Build email content (Requirements 7.2, 7.3)
      const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/price-approvals`;

      const html = `
        <h2>Auto-Approval Summary</h2>
        <p>Your auto-approval rules have processed price changes.</p>
        
        <h3>Summary</h3>
        <ul>
          <li><strong>Price Changes Auto-Approved:</strong> ${approvedCount}</li>
          <li><strong>Rules Triggered:</strong> ${uniqueRuleNames.length}</li>
        </ul>
        
        <h3>Rules That Triggered Approvals</h3>
        <ul>
          ${uniqueRuleNames.map((name) => `<li>${name}</li>`).join("\n          ")}
        </ul>
        
        <p><a href="${dashboardUrl}">View Price Approvals in Dashboard</a></p>
        
        <hr />
        <p style="font-size: 12px; color: #666;">
          You received this email because you have auto-approval rules enabled and email notifications turned on.
          To manage your notification preferences, visit your account settings.
        </p>
      `;

      // Send single batched email to each user (Requirement 7.4)
      const emailPromises = users.map((user) =>
        NotificationSender.sendEmail(
          user.email,
          `[PricePilot] ${approvedCount} Price ${approvedCount === 1 ? "Change" : "Changes"} Auto-Approved`,
          html,
        ).catch((error) => {
          // Handle email failures gracefully (log but don't throw)
          // Requirement: Handle email failures gracefully
          if (process.env.NODE_ENV !== "test") {
            console.error(
              `[AutoApproval] Failed to send email to ${user.email}:`,
              error
            );
          }
        })
      );

      // Wait for all emails to be sent (or fail gracefully)
      await Promise.allSettled(emailPromises);
    } catch (error) {
      // Handle email failures gracefully (log but don't throw)
      // Requirement: Handle email failures gracefully
      if (process.env.NODE_ENV !== "test") {
        console.error(
          "[AutoApproval] Failed to send auto-approval notifications:",
          error
        );
      }
    }
  },
};
