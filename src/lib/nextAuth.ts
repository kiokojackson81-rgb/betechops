import NextAuth from "next-auth/next";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAILS } from "@/lib/auth";
import type { AttendantCategory } from "@prisma/client";

const ALLOWED_DOMAINS = ["betech.co.ke", "yourcompany.com"];

function isAllowedDomain(email: string) {
  return ALLOWED_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
}

function inferCategory(email: string): AttendantCategory {
  const prefix = email.split("@")[0].toLowerCase();
  if (prefix.includes("marketing") || prefix.includes("mkt")) return "MARKETING_OPS";
  if (prefix.includes("support")) return "SUPPORT_OPS";
  if (prefix.includes("jumia") || prefix.includes("kilimall")) return "JUMIA_KILIMALL_OPS";
  if (prefix.includes("ops") || prefix.includes("betech")) return "BETECH_OPS";
  return "DIRECT_SALES_OPS";
}

type ExtendedToken = {
  email?: string;
  sub?: string;
  role?: string;
  attendantCategory?: AttendantCategory;
};

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER || "",
      from: process.env.EMAIL_FROM || "",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }: { user: { email?: string; name?: string | null; image?: string | null }; account?: { provider: string } }) {
      const email = (user.email || "").toLowerCase();
      if (!email) return false;

      const isAdmin = ADMIN_EMAILS.includes(email);
      if (account?.provider === "google" && !isAdmin) return false;
      if (!isAdmin && !isAllowedDomain(email)) return false;

      const category: AttendantCategory = isAdmin ? "BETECH_OPS" : inferCategory(email);
      const displayName = user.name ?? email.split("@")[0];
      await prisma.user.upsert({
        where: { email },
        update: {
          role: isAdmin ? "ADMIN" : "ATTENDANT",
          isActive: true,
          attendantCategory: category,
          name: displayName,
          image: user.image ?? "",
        },
        create: {
          email,
          name: displayName,
          image: user.image ?? "",
          role: isAdmin ? "ADMIN" : "ATTENDANT",
          attendantCategory: category,
          isActive: true,
        },
      });
      return true;
    },

    async jwt({ token, user }: { token: ExtendedToken; user?: { role?: string; attendantCategory?: AttendantCategory; email?: string; id?: string } }) {
      if (user) {
        token.role = user.role ?? token.role;
        if (user.attendantCategory) token.attendantCategory = user.attendantCategory;
        if (user.email) token.email = user.email;
        if (user.id) token.sub = user.id;
        return token as JWT;
      }

      const email = (token.email || "").toLowerCase();
      try {
        let dbUser = null;
        if (token.sub) {
        dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, role: true, attendantCategory: true, email: true },
        });
        }
        if (!dbUser && email) {
          dbUser = await prisma.user.findUnique({
            where: { email },
          select: { id: true, role: true, attendantCategory: true, email: true },
          });
        }
        if (dbUser) {
          token.role = dbUser.role ?? token.role;
          token.attendantCategory = dbUser.attendantCategory ?? token.attendantCategory;
          token.email = dbUser.email ?? token.email;
          if (!token.sub && "id" in dbUser && dbUser.id) token.sub = dbUser.id;
        }
      } catch {
        token.role = token.role ?? "ATTENDANT";
        token.attendantCategory = token.attendantCategory ?? "DIRECT_SALES_OPS";
      }

      return token as JWT;
    },

    async session({ session, token }: { session: Session | Record<string, unknown>; token: ExtendedToken }) {
      const s = session as Session;
      if (!s.user) s.user = {};
      (s.user as Record<string, unknown>).role = token.role ?? "ATTENDANT";
      (s.user as Record<string, unknown>).attendantCategory = token.attendantCategory ?? "DIRECT_SALES_OPS";
      return s;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};

export default NextAuth;
