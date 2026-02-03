import { NotificationSender } from "./notification-sender";
import { prisma } from "@/lib/prisma";

/**
 * Email Service for PricePilot
 * 
 * Provides email notification functionality for price approval workflows.
 * Uses SystemConfig credentials managed by Super Admin via NotificationSender.
 * 
 * Requirements: 2.10.2
 * Task: 11.5 - Implement email notification system
 */
export class EmailService {
    /**
     * Send pending approval notification email
     * 
     * Notifies users when there are price changes awaiting approval.
     * Only sends to users with emailNotifications enabled.
     * 
     * @param tenantId - The tenant ID to send notifications for
     * @param pendingCount - Number of pending price changes
     * 
     * Requirements: 2.10.2
     */
    static async sendPendingApprovalNotification(
        tenantId: string,
        pendingCount: number
    ): Promise<void> {
        try {
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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Price Changes Awaiting Approval</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h2 style="color: #0070f3; margin-top: 0;">Price Changes Awaiting Approval</h2>
            <p style="font-size: 16px; margin: 20px 0;">
              You have <strong style="color: #0070f3; font-size: 18px;">${pendingCount}</strong> price ${pendingCount === 1 ? "change" : "changes"} waiting for your review.
            </p>
            
            <p style="font-size: 14px; color: #666; margin: 20px 0;">
              These price changes have been calculated based on your pricing rules and competitor data, but require your approval before being applied to your store.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="background-color: #0070f3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                Review Pending Changes
              </a>
            </div>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              To stop receiving these notifications, update your notification preferences in account settings.
            </p>
          </div>
        </body>
        </html>
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
                            `[EmailService] Failed to send pending approval email to ${user.email}:`,
                            error
                        );
                    }
                })
            );

            await Promise.allSettled(emailPromises);
        } catch (error) {
            if (process.env.NODE_ENV !== "test") {
                console.error(
                    "[EmailService] Failed to send pending approval notifications:",
                    error
                );
            }
        }
    }

    /**
     * Send daily approval summary email
     * 
     * Sends a daily summary of approval activity to users with email notifications enabled.
     * Includes counts of manually approved, auto-approved, rejected, and pending changes.
     * 
     * @param tenantId - The tenant ID to send summary for
     * 
     * Requirements: 2.10.2
     */
    static async sendDailyApprovalSummary(tenantId: string): Promise<void> {
        try {
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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Price Approval Summary</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h2 style="color: #0070f3; margin-top: 0;">Daily Price Approval Summary</h2>
            <p style="font-size: 14px; color: #666; margin: 10px 0 20px 0;">
              Here's your price approval activity for ${yesterday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}:
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 14px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #374151;">Status</th>
                  <th style="padding: 14px; text-align: right; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #374151;">Count</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 14px; border-bottom: 1px solid #e5e7eb;">
                    <span style="font-size: 18px; margin-right: 8px;">✅</span>
                    <span style="color: #059669; font-weight: 500;">Manually Approved</span>
                  </td>
                  <td style="padding: 14px; text-align: right; border-bottom: 1px solid #e5e7eb;">
                    <strong style="font-size: 18px; color: #059669;">${manualApproved}</strong>
                  </td>
                </tr>
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 14px; border-bottom: 1px solid #e5e7eb;">
                    <span style="font-size: 18px; margin-right: 8px;">🤖</span>
                    <span style="color: #3b82f6; font-weight: 500;">Auto-Approved</span>
                  </td>
                  <td style="padding: 14px; text-align: right; border-bottom: 1px solid #e5e7eb;">
                    <strong style="font-size: 18px; color: #3b82f6;">${autoApproved}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px; border-bottom: 1px solid #e5e7eb;">
                    <span style="font-size: 18px; margin-right: 8px;">❌</span>
                    <span style="color: #dc2626; font-weight: 500;">Rejected</span>
                  </td>
                  <td style="padding: 14px; text-align: right; border-bottom: 1px solid #e5e7eb;">
                    <strong style="font-size: 18px; color: #dc2626;">${rejected}</strong>
                  </td>
                </tr>
                <tr style="background-color: ${pending > 0 ? '#fef3c7' : '#f9fafb'};">
                  <td style="padding: 14px;">
                    <span style="font-size: 18px; margin-right: 8px;">⏳</span>
                    <span style="color: ${pending > 0 ? '#d97706' : '#6b7280'}; font-weight: 500;">Still Pending</span>
                  </td>
                  <td style="padding: 14px; text-align: right;">
                    <strong style="font-size: 18px; color: ${pending > 0 ? '#d97706' : '#6b7280'};">${pending}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            
            ${pending > 0 ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="background-color: #0070f3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                  Review ${pending} Pending ${pending === 1 ? "Change" : "Changes"}
                </a>
              </div>
            ` : `
              <p style="text-align: center; color: #059669; font-weight: 500; margin: 20px 0;">
                ✨ All caught up! No pending changes.
              </p>
            `}
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              To stop receiving daily summaries, update your notification preferences in account settings.
            </p>
          </div>
        </body>
        </html>
      `;

            // Send email to each user
            const emailPromises = users.map((user) =>
                NotificationSender.sendEmail(
                    user.email,
                    `[PricePilot] Daily Approval Summary - ${yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                    html,
                ).catch((error) => {
                    if (process.env.NODE_ENV !== "test") {
                        console.error(
                            `[EmailService] Failed to send daily summary to ${user.email}:`,
                            error
                        );
                    }
                })
            );

            await Promise.allSettled(emailPromises);
        } catch (error) {
            if (process.env.NODE_ENV !== "test") {
                console.error(
                    "[EmailService] Failed to send daily approval summary:",
                    error
                );
            }
        }
    }

    /**
     * Send auto-approval notification email
     * 
     * Sends a batched email notification to users when price changes are auto-approved.
     * Includes summary of approved count and rules that triggered approvals.
     * 
     * @param tenantId - The tenant ID to send notifications for
     * @param approvedCount - Number of price changes auto-approved
     * @param ruleNames - Array of rule names that triggered approvals
     * 
     * Requirements: 2.10.2
     */
    static async sendAutoApprovalNotification(
        tenantId: string,
        approvedCount: number,
        ruleNames: string[]
    ): Promise<void> {
        try {
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

            // Get unique rule names for display
            const uniqueRuleNames = Array.from(new Set(ruleNames));

            const dashboardUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/price-approvals`;

            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Auto-Approval Summary</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f0f9ff; border-radius: 8px; padding: 30px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
            <h2 style="color: #1e40af; margin-top: 0;">
              <span style="font-size: 24px; margin-right: 8px;">🤖</span>
              Auto-Approval Summary
            </h2>
            <p style="font-size: 14px; color: #475569; margin: 10px 0 20px 0;">
              Your auto-approval rules have processed price changes automatically.
            </p>
            
            <div style="background-color: white; border-radius: 6px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="color: #1e40af; margin-top: 0; font-size: 16px;">Summary</h3>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong style="color: #374151;">Price Changes Auto-Approved:</strong>
                  <span style="float: right; color: #3b82f6; font-size: 18px; font-weight: 600;">${approvedCount}</span>
                </li>
                <li style="padding: 10px 0;">
                  <strong style="color: #374151;">Rules Triggered:</strong>
                  <span style="float: right; color: #3b82f6; font-size: 18px; font-weight: 600;">${uniqueRuleNames.length}</span>
                </li>
              </ul>
            </div>
            
            <div style="background-color: white; border-radius: 6px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="color: #1e40af; margin-top: 0; font-size: 16px;">Rules That Triggered Approvals</h3>
              <ul style="margin: 10px 0; padding-left: 20px; color: #475569;">
                ${uniqueRuleNames.map((name) => `<li style="padding: 5px 0;">${name}</li>`).join("\n                ")}
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                View Price Approvals in Dashboard
              </a>
            </div>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              You received this email because you have auto-approval rules enabled and email notifications turned on.
              To manage your notification preferences, visit your account settings.
            </p>
          </div>
        </body>
        </html>
      `;

            // Send email to each user
            const emailPromises = users.map((user) =>
                NotificationSender.sendEmail(
                    user.email,
                    `[PricePilot] ${approvedCount} Price ${approvedCount === 1 ? "Change" : "Changes"} Auto-Approved`,
                    html,
                ).catch((error) => {
                    if (process.env.NODE_ENV !== "test") {
                        console.error(
                            `[EmailService] Failed to send auto-approval email to ${user.email}:`,
                            error
                        );
                    }
                })
            );

            await Promise.allSettled(emailPromises);
        } catch (error) {
            if (process.env.NODE_ENV !== "test") {
                console.error(
                    "[EmailService] Failed to send auto-approval notifications:",
                    error
                );
            }
        }
    }

    /**
     * Send delegation notification email
     * 
     * Notifies a user when they have been delegated approval authority.
     * 
     * @param toUserEmail - Email of the user receiving delegation
     * @param toUserName - Name of the user receiving delegation
     * @param fromUserName - Name of the user delegating authority
     * @param startDate - When the delegation starts
     * @param endDate - When the delegation ends
     * 
     * Requirements: 2.10.3
     */
    static async sendDelegationNotification(
        toUserEmail: string,
        toUserName: string | null,
        fromUserName: string | null,
        startDate: Date,
        endDate: Date
    ): Promise<void> {
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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Approval Authority Delegated</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
            <h2 style="color: #92400e; margin-top: 0;">
              <span style="font-size: 24px; margin-right: 8px;">👤</span>
              Approval Authority Delegated to You
            </h2>
            <p style="font-size: 16px; color: #78350f; margin: 10px 0 20px 0;">
              Hello ${toUserName || 'there'},
            </p>
            
            <p style="font-size: 14px; color: #78350f; margin: 10px 0;">
              <strong>${fromUserName || 'A team member'}</strong> has delegated their price approval authority to you.
            </p>
            
            <div style="background-color: white; border-radius: 6px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="color: #92400e; margin-top: 0; font-size: 16px;">Delegation Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">From:</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; color: #475569;">${fromUserName || 'Team member'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Start Date:</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; color: #475569;">${formatDate(startDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">End Date:</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; color: #475569;">${formatDate(endDate)}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 14px; color: #78350f; margin: 20px 0;">
              During this period, you will be able to approve or reject price changes on their behalf.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="background-color: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                View Price Approvals
              </a>
            </div>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              If you have questions about this delegation, please contact ${fromUserName || 'the delegating user'} or your team administrator.
            </p>
          </div>
        </body>
        </html>
      `;

            await NotificationSender.sendEmail(
                toUserEmail,
                `[PricePilot] You've Been Delegated Approval Authority`,
                html,
            );
        } catch (error) {
            if (process.env.NODE_ENV !== "test") {
                console.error(
                    `[EmailService] Failed to send delegation notification to ${toUserEmail}:`,
                    error
                );
            }
        }
    }
}
