import NextAuth from "next-auth/next";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAILS } from "@/lib/auth";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    // signIn: upsert user and force ADMIN for any configured ADMIN_EMAILS
    async signIn({ user }: { user: { email?: string; name?: string | null; image?: string | null } }) {
      const emails = ADMIN_EMAILS;
      const email = (user.email || "").toLowerCase();
      if (!email) return false;
      try {
        if (emails.includes(email)) {
          // Force ADMIN
          await prisma.user.upsert({
            where: { email },
            update: { role: "ADMIN", isActive: true },
            create: { email, name: user.name ?? "Admin", image: user.image ?? "", role: "ADMIN", attendantCategory: "GENERAL", isActive: true },
          });
          return true;
        }

        // Default: ATTENDANT
        await prisma.user.upsert({
          where: { email },
          update: { role: "ATTENDANT", isActive: true },
          create: { email, name: user.name ?? email.split("@")[0], image: user.image ?? "", role: "ATTENDANT", attendantCategory: "GENERAL", isActive: true },
        });
        return true;
      } catch {
        // If DB not ready, still allow sign-in but roles will be resolved later via fallback
        return true;
      }
    },

    // jwt: attach DB role to token (lookup by sub (id) or email)
    async jwt({ token, user }: { token: unknown; user?: { email?: string } }) {
      // ensure email is set on token when user logs in
      const t0 = token as { email?: string; role?: string; sub?: string };
      if (user?.email) t0.email = user.email;
      const email = (t0.email || "").toLowerCase();

      // If it's the owner email, force ADMIN in the token (no DB needed)
      if (email === "kiokojackson81@gmail.com") {
        t0.role = "ADMIN";
        return token as unknown as JWT;
      }

      // Otherwise, best-effort fetch from DB; fall back to ATTENDANT if it fails
      try {
        let dbUser: { role?: string } | null = null;
        const t = token as { sub?: string; email?: string; role?: string };
        if (t.sub) {
          dbUser = await prisma.user.findUnique({ where: { id: t.sub }, select: { role: true } });
        }
        if (!dbUser && t.email) {
          dbUser = await prisma.user.findUnique({ where: { email: (t.email as string).toLowerCase() }, select: { role: true } });
        }
        t0.role = dbUser?.role || "ATTENDANT";
      } catch {
        t0.role = "ATTENDANT";
      }
      return token as unknown as JWT;
    },

    // session: expose role from token
    async session({ session, token }: { session: unknown; token: unknown }) {
      const s = session as { user?: Record<string, unknown> };
      const t = token as { role?: string };
      if (!s.user) s.user = {};
      (s.user as { role?: string }).role = t.role ?? "ATTENDANT";
      return s as unknown as Session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};

export default NextAuth;
