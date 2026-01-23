import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
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
          throw new Error("Invalid credentials");
        }

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );

        if (!isPasswordCorrect) {
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sub = user.id; // Also set standard sub claim
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.isSuperAdmin = user.isSuperAdmin;

        // Generate a unique session ID for this login
        const sessionId = Math.random().toString(36).substring(2, 15);
        token.sessionId = sessionId;

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

        // Record the session in DB for device management/revocation
        await (prisma as any).session.create({
          data: {
            sessionToken: sessionId,
            userId: user.id,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
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
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour
  },
  secret: process.env.NEXTAUTH_SECRET,
};
