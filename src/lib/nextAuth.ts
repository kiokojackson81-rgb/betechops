import NextAuth from "next-auth/next";
import type { Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type ExtendedToken = {
  email?: string;
  sub?: string;
  role?: string;
  attendantCategory?: string;
};

const REQUIRED_DOMAIN = "@betech.co.ke";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = credentials?.password || "";

        if (!email || !password || !email.endsWith(REQUIRED_DOMAIN)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, role: true, attendantCategory: true, isActive: true },
        });
        if (!user || !user.isActive) return null;

        // Credentials-based auth is disabled here because the schema does not
        // expose a password column on the User model. Return null to indicate
        // authorization failed when using plain credentials. OAuth providers
        // or other configured providers will continue to work.
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }: { token: ExtendedToken; user?: { role?: string; attendantCategory?: string; email?: string; id?: string } }) {
      if (user) {
        token.role = user.role ?? token.role;
        token.attendantCategory = user.attendantCategory ?? token.attendantCategory;
        token.email = user.email ?? token.email;
        token.sub = user.id ?? token.sub;
        return token;
      }

      if (!token.email) return token;
      const existing = await prisma.user.findUnique({
        where: { email: token.email },
        select: { id: true, role: true, attendantCategory: true },
      });
      if (existing) {
        token.role = existing.role ?? token.role;
        token.attendantCategory = existing.attendantCategory ?? token.attendantCategory;
        token.sub = existing.id ?? token.sub;
      }
      return token;
    },

    async session({ session, token }: { session: Session | Record<string, unknown>; token: ExtendedToken }) {
      const s = session as Session;
      if (!s.user) s.user = {};
      (s.user as Record<string, unknown>).role = token.role ?? "ATTENDANT";
      (s.user as Record<string, unknown>).attendantCategory = token.attendantCategory ?? "DIRECT_SALES_OPS";
      return s;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};

export default NextAuth;
