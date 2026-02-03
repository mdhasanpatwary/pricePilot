import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cacheWarmingService } from "@/lib/services/cache-warming";
import { securityMonitoringService } from "@/lib/services/monitoring/security-monitoring";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "checkbox" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true },
        });

        if (!user || !user.passwordHash) {
          // Record authentication failure for security monitoring
          // Note: We can't get IP address here, but we can track the email attempt
          await securityMonitoringService.recordAuthFailure({
            ipAddress: 'unknown', // Will be enriched by middleware
            email: credentials.email,
            additionalData: {
              reason: 'user_not_found',
            },
          }).catch(err => {
            console.error('[Auth] Failed to record auth failure:', err);
          });

          throw new Error("Invalid credentials");
        }

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );

        if (!isPasswordCorrect) {
          // Record authentication failure for security monitoring
          await securityMonitoringService.recordAuthFailure({
            ipAddress: 'unknown', // Will be enriched by middleware
            email: credentials.email,
            userId: user.id,
            additionalData: {
              reason: 'invalid_password',
            },
          }).catch(err => {
            console.error('[Auth] Failed to record auth failure:', err);
          });

          throw new Error("Invalid credentials");
        }

        if (!(user as any).emailVerified) {
          throw new Error("Please verify your email before logging in");
        }

        return {
          id: user.id,
          email: user.email,
          name: (user as any).tenant.companyName,
          role: user.role,
          tenantId: user.tenantId,
          isSuperAdmin: user.isSuperAdmin,
          rememberMe: credentials.rememberMe === 'true' || credentials.rememberMe === 'on',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.sub = user.id; // Also set standard sub claim
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.isSuperAdmin = user.isSuperAdmin;

        // Generate a unique session ID for this login
        const sessionId = Math.random().toString(36).substring(2, 15);
        token.sessionId = sessionId;

        // Check if "remember me" was requested (passed via user object)
        const rememberMe = (user as any).rememberMe || false;
        token.rememberMe = rememberMe;

        // ENFORCE CONCURRENT SESSION LIMIT (Max 5)
        const activeSessions = await (prisma as any).session.count({
          where: { userId: user.id },
        });

        if (activeSessions >= 5) {
          // Optional: Revoke oldest session to make room
          const oldestSession = await (prisma as any).session.findFirst({
            where: { userId: user.id },
            orderBy: { lastUsedAt: "asc" },
          });
          if (oldestSession) {
            await (prisma as any).session.delete({
              where: { id: oldestSession.id },
            });
          }
        }

        // Set expiration based on remember me
        const expiresIn = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days or 24 hours

        // Record the session in DB for device management/revocation
        await (prisma as any).session.create({
          data: {
            sessionToken: sessionId,
            userId: user.id,
            expires: new Date(Date.now() + expiresIn),
          },
        });

        // Warm cache on login (fire-and-forget pattern)
        // Requirement 3.1: Warm cache with essential data on tenant login
        if (user.tenantId) {
          cacheWarmingService.warmOnLogin(user.tenantId).catch((error) => {
            console.error('[Auth] Cache warming failed on login:', error);
            // Don't block login on cache warming failure
          });
        }
      }

      // Handle session updates (e.g., password change)
      if (trigger === 'update' && session?.invalidateSession) {
        // Force logout by returning null
        return null as any;
      }

      // ON EVERY REQUEST: Verify session still exists in DB (revocation check)
      if (token.sessionId) {
        const sessionRecord = await (prisma as any).session.findUnique({
          where: { sessionToken: token.sessionId as string },
        });

        if (!sessionRecord) {
          // Session was revoked! Force logout by returning empty token
          return null as any;
        }

        // Check if session has expired
        if (new Date(sessionRecord.expires) < new Date()) {
          // Session expired, delete it and force logout
          await (prisma as any).session.delete({
            where: { id: sessionRecord.id },
          }).catch(() => {
            // Ignore errors if already deleted
          });
          return null as any;
        }

        // Update lastUsedAt once an hour to minimize DB writes
        const lastUpdate = new Date(sessionRecord.lastUsedAt).getTime();
        if (Date.now() - lastUpdate > 3600000) {
          await (prisma as any).session.update({
            where: { id: sessionRecord.id },
            data: { lastUsedAt: new Date() },
          });
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.isSuperAdmin = token.isSuperAdmin;
        session.user.sessionId = token.sessionId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days (will be overridden by token expiry for non-remember-me)
    updateAge: 60 * 60, // 1 hour
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
