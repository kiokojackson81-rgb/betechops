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
  isActive?: boolean;
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

        if (!email || !password) return null;
        if (!email.endsWith(REQUIRED_DOMAIN)) {
          // enforce corporate domain
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          // avoid selecting `attendantCategory` here — if the DB enum doesn't match
          // the Prisma schema this can throw on read. Omit for now to allow login.
          select: { id: true, email: true, name: true, password: true, role: true, isActive: true },
        });

        if (!user || !user.isActive || !user.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as any;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }: { token: ExtendedToken; user?: { role?: string; attendantCategory?: string; email?: string; id?: string; isActive?: boolean } }) {
      if (user) {
        token.role = user.role ?? token.role;
        token.attendantCategory = user.attendantCategory ?? token.attendantCategory;
        token.email = user.email ?? token.email;
        token.sub = user.id ?? token.sub;
        token.isActive = (user as any).isActive ?? token.isActive ?? true;
        return token;
      }

      if (!token.email) return token;
      // Avoid selecting `attendantCategory` directly because a DB enum mismatch
      // can cause Prisma to throw when reading the field. Fetch essential fields
      // and skip attendantCategory for now — this lets the jwt flow continue.
      try {
        const existing = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, isActive: true },
        });
        if (existing) {
          token.role = existing.role ?? token.role;
          token.sub = existing.id ?? token.sub;
          token.isActive = existing.isActive ?? token.isActive ?? true;
        }
      } catch (err) {
        console.error("nextAuth: safe user lookup failed:", err);
      }
      // Attempt to enrich token with `attendantCategory` using a raw query
      // that casts the DB enum to text. This avoids Prisma enum parsing
      // errors when the DB enum labels differ from the Prisma schema.
      try {
        const rows = (await prisma.$queryRaw`
          SELECT "attendantCategory"::text AS "attendantCategory"
          FROM "User"
          WHERE lower(email) = lower(${token.email})
          LIMIT 1
        `) as Array<{ attendantCategory?: string | null }>;
        if (rows && rows[0] && typeof rows[0].attendantCategory !== "undefined") {
          token.attendantCategory = rows[0].attendantCategory ?? token.attendantCategory;
        }
      } catch (err) {
        console.error("nextAuth: failed to attach attendantCategory via raw query:", err);
      }
      return token;
    },

    async session({ session, token }: { session: Session | Record<string, unknown>; token: ExtendedToken }) {
      const s = session as Session;
      if (!s.user) s.user = {};
      (s.user as Record<string, unknown>).role = token.role ?? "ATTENDANT";
      (s.user as Record<string, unknown>).attendantCategory = token.attendantCategory ?? null;
      (s.user as Record<string, unknown>).isActive = token.isActive ?? true;
      // expose the attendant id so API routes depending on session.user.id keep working
      (s.user as Record<string, unknown>).id = token.sub ?? null;
      return s;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};

export default NextAuth;
