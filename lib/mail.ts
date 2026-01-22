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
};
