import { logger } from "./logger";

/**
 * Mock email service for PricePilot
 * In production, this would use SendGrid, Resend, or AWS SES
 */
export const mailService = {
  /**
   * Send verification email
   */
  sendVerificationEmail: async (email: string, token: string) => {
    const verificationUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/verify?token=${token}`;

    // In production: await transporter.sendMail(...)

    logger.info(`[Email] Verification email sent to ${email}`, {
      url: verificationUrl,
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`
      -----------------------------------------
      EMAIL VERIFICATION (DEV MOCK)
      To: ${email}
      URL: ${verificationUrl}
      -----------------------------------------
      `);
    }

    return true;
  },

  /**
   * Send password reset email
   */
  sendPasswordResetEmail: async (email: string, token: string) => {
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`;

    logger.info(`[Email] Password reset email sent to ${email}`, {
      url: resetUrl,
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`
      -----------------------------------------
      PASSWORD RESET (DEV MOCK)
      To: ${email}
      URL: ${resetUrl}
      -----------------------------------------
      `);
    }

    return true;
  },
};
