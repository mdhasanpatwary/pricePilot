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

  /**
   * Send pending approval notification email
   * Task 14.3: Implement sendPendingApprovalNotification
   * 
   * Notifies users when there are price changes awaiting approval.
   * 
   * @param tenantId - The tenant ID to send notifications for
   * @param pendingCount - Number of pending price changes
   */
  sendPendingApprovalNotification: async (
    tenantId: string,
    pendingCount: number
  ): Promise<void> => {
    try {
      const { prisma } = await import("@/lib/prisma");

      // Load users with emailNotifications=true for tenant
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          emailNotifications: true,
        },
        select: {
          email: true,
          name: true,
        },
      });

      // If no users with notifications enabled, return early
      if (users.length === 0) {
        return;
      }

      const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/price-approvals`;

      const html = `
        <h2>Price Changes Awaiting Approval</h2>
        <p>You have <strong>${pendingCount}</strong> price ${pendingCount === 1 ? "change" : "changes"} waiting for your review.</p>
        
        <p>These price changes have been calculated based on your pricing rules and competitor data, but require your approval before being applied to your store.</p>
        
        <p style="margin: 30px 0;">
          <a href="${dashboardUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review Pending Changes
          </a>
        </p>
        
        <hr />
        <p style="font-size: 12px; color: #666;">
          To stop receiving these notifications, update your notification preferences in account settings.
        </p>
      `;

      // Send email to each user
      const emailPromises = users.map((user) =>
        NotificationSender.sendEmail(
          user.email,
          `[PricePilot] ${pendingCount} Price ${pendingCount === 1 ? "Change" : "Changes"} Awaiting Approval`,
          html,
        ).catch((error) => {
          if (process.env.NODE_ENV !== "test") {
            console.error(
              `[PendingApproval] Failed to send email to ${user.email}:`,
              error
            );
          }
        })
      );

      await Promise.allSettled(emailPromises);
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.error(
          "[PendingApproval] Failed to send pending approval notifications:",
          error
        );
      }
    }
  },

  /**
   * Send delegation notification email
   * Task 15.6: Add delegation notification emails
   * 
   * Notifies a user when they have been delegated approval authority.
   * 
   * @param toUserEmail - Email of the user receiving delegation
   * @param toUserName - Name of the user receiving delegation
   * @param fromUserName - Name of the user delegating authority
   * @param startDate - When the delegation starts
   * @param endDate - When the delegation ends
   */
  sendDelegationNotification: async (
    toUserEmail: string,
    toUserName: string | null,
    fromUserName: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<void> => {
    try {
      const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/price-approvals`;

      const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const html = `
        <h2>Approval Authority Delegated to You</h2>
        <p>Hello ${toUserName || 'there'},</p>
        
        <p><strong>${fromUserName || 'A team member'}</strong> has delegated their price approval authority to you.</p>
        
        <h3>Delegation Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>From:</strong></td>
            <td style="padding: 12px; border: 1px solid #ddd;">${fromUserName || 'Team member'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>Start Date:</strong></td>
            <td style="padding: 12px; border: 1px solid #ddd;">${formatDate(startDate)}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; background-color: #f5f5f5;"><strong>End Date:</strong></td>
            <td style="padding: 12px; border: 1px solid #ddd;">${formatDate(endDate)}</td>
          </tr>
        </table>
        
        <p>During this period, you will be able to approve or reject price changes on their behalf.</p>
        
        <p style="margin: 30px 0;">
          <a href="${dashboardUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Price Approvals
          </a>
        </p>
        
        <hr />
        <p style="font-size: 12px; color: #666;">
          If you have questions about this delegation, please contact ${fromUserName || 'the delegating user'} or your team administrator.
        </p>
      `;

      await NotificationSender.sendEmail(
        toUserEmail,
        `[PricePilot] You've Been Delegated Approval Authority`,
        html,
      );
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.error(
          `[Delegation] Failed to send delegation notification to ${toUserEmail}:`,
          error
        );
      }
    }
  },

  /**
   * Send daily approval summary email
   * Task 14.4: Implement sendDailyApprovalSummary
   * 
   * Sends a daily summary of approval activity to users.
   * 
   * @param tenantId - The tenant ID to send summary for
   */
  sendDailyApprovalSummary: async (tenantId: string): Promise<void> => {
    try {
      const { prisma } = await import("@/lib/prisma");

      // Calculate yesterday's date range
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get approval statistics for yesterday
      const [approved, rejected, pending, autoApproved] = await Promise.all([
        prisma.pendingPriceChange.count({
          where: {
            tenantId,
            status: "APPROVED",
            reviewedAt: {
              gte: yesterday,
              lt: today,
            },
          },
        }),
        prisma.pendingPriceChange.count({
          where: {
            tenantId,
            status: "REJECTED",
            reviewedAt: {
              gte: yesterday,
              lt: today,
            },
          },
        }),
        prisma.pendingPriceChange.count({
          where: {
            tenantId,
            status: "PENDING",
          },
        }),
        prisma.pendingPriceChange.count({
          where: {
            tenantId,
            status: "APPROVED",
            reviewedBy: "system:auto-approval",
            reviewedAt: {
              gte: yesterday,
              lt: today,
            },
          },
        }),
      ]);

      // Skip email if no activity
      if (approved === 0 && rejected === 0 && pending === 0) {
        return;
      }

      // Load users with emailNotifications=true for tenant
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          emailNotifications: true,
        },
        select: {
          email: true,
          name: true,
        },
      });

      if (users.length === 0) {
        return;
      }

      const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/price-approvals`;
      const manualApproved = approved - autoApproved;

      const html = `
        <h2>Daily Price Approval Summary</h2>
        <p>Here's your price approval activity for ${yesterday.toLocaleDateString()}:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Status</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Count</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">✅ Manually Approved</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #ddd;"><strong>${manualApproved}</strong></td>
          </tr>
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 12px; border: 1px solid #ddd;">🤖 Auto-Approved</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #ddd;"><strong>${autoApproved}</strong></td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">❌ Rejected</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #ddd;"><strong>${rejected}</strong></td>
          </tr>
          <tr style="background-color: #fff3cd;">
            <td style="padding: 12px; border: 1px solid #ddd;">⏳ Still Pending</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #ddd;"><strong>${pending}</strong></td>
          </tr>
        </table>
        
        ${pending > 0 ? `
          <p style="margin: 30px 0;">
            <a href="${dashboardUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Review ${pending} Pending ${pending === 1 ? "Change" : "Changes"}
            </a>
          </p>
        ` : ""}
        
        <hr />
        <p style="font-size: 12px; color: #666;">
          To stop receiving daily summaries, update your notification preferences in account settings.
        </p>
      `;

      // Send email to each user
      const emailPromises = users.map((user) =>
        NotificationSender.sendEmail(
          user.email,
          `[PricePilot] Daily Approval Summary - ${yesterday.toLocaleDateString()}`,
          html,
        ).catch((error) => {
          if (process.env.NODE_ENV !== "test") {
            console.error(
              `[DailySummary] Failed to send email to ${user.email}:`,
              error
            );
          }
        })
      );

      await Promise.allSettled(emailPromises);
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.error(
          "[DailySummary] Failed to send daily approval summary:",
          error
        );
      }
    }
  },
};
