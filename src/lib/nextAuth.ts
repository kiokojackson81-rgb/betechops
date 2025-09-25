/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    // signIn: upsert user and force ADMIN for the configured ADMIN_EMAIL
    async signIn({ user }: { user: { email?: string; name?: string | null; image?: string | null } }) {
      const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      if (!email) return false;
      try {
        if (email === ADMIN_EMAIL) {
          // Force ADMIN
          await (prisma as any).user.upsert({
            where: { email },
            update: { role: "ADMIN", isActive: true },
            create: { email, name: user.name ?? "Admin", image: user.image ?? "", role: "ADMIN", isActive: true },
          });
          return true;
        }

        // Default: ATTENDANT
        await (prisma as any).user.upsert({
          where: { email },
          update: { role: "ATTENDANT", isActive: true },
          create: { email, name: user.name ?? email.split("@")[0], image: user.image ?? "", role: "ATTENDANT", isActive: true },
        });
        return true;
      } catch {
        // If DB not ready, still allow sign-in but roles will be resolved later via fallback
        return true;
      }
    },

    // jwt: attach DB role to token
    async jwt({ token }: { token: any }) {
      if (!token.sub) return token;
      try {
        const dbUser = await (prisma as any).user.findUnique({ where: { id: token.sub }, select: { role: true } });
        token.role = dbUser?.role ?? "ATTENDANT";
      } catch {
        token.role = token.role ?? "ATTENDANT";
      }
      return token;
    },

    // session: expose role from token
    async session({ session, token }: { session: any; token: any }) {
      (session.user as any).role = token.role ?? "ATTENDANT";
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};

export default NextAuth;
