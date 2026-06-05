import NextAuth from "next-auth/next";
import type { Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getAllowedAuthOrigins, isAllowedAuthOrigin } from "@/lib/runtimeUrls";
import { resolveFirebasePhoneUser } from "@/lib/firebasePhoneAuth";

type ExtendedToken = {
  email?: string;
  phone?: string;
  sub?: string;
  role?: string;
  attendantCategory?: string;
  isActive?: boolean;
  isAgent?: boolean;
  agentStatus?: string | null;
  lastLoginMethod?: string | null;
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

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            isActive: true,
            agentProfile: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        if (!user || !user.isActive || !user.password) return null;
        const isCorporateUser = email.endsWith(REQUIRED_DOMAIN);
        const isAgentUser = Boolean(user.agentProfile);
        if (!isCorporateUser && !isAgentUser) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isAgent: isAgentUser,
          agentStatus: user.agentProfile?.status ?? null,
        };
      },
    }),
    CredentialsProvider({
      id: "firebase-phone",
      name: "Firebase Phone OTP",
      credentials: {
        idToken: { label: "Firebase ID Token", type: "text" },
      },
      async authorize(credentials) {
        const idToken = String(credentials?.idToken || "").trim();
        if (!idToken) return null;

        const resolved = await resolveFirebasePhoneUser(idToken);
        return {
          id: resolved.user.id,
          email: resolved.user.email ?? undefined,
          name: resolved.user.name,
          role: resolved.user.role,
          attendantCategory: resolved.user.attendantCategory ?? undefined,
          isActive: resolved.user.isActive,
          isAgent: Boolean(resolved.user.agentProfile),
          agentStatus: resolved.user.agentProfile?.status ?? null,
          phone: resolved.user.phone ?? undefined,
          lastLoginMethod: resolved.user.lastLoginMethod ?? "firebase_phone",
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }: { token: ExtendedToken; user?: { role?: string; attendantCategory?: string; email?: string; id?: string; isActive?: boolean; isAgent?: boolean; agentStatus?: string | null; phone?: string; lastLoginMethod?: string | null } }) {
      if (user) {
        token.role = user.role ?? token.role;
        token.attendantCategory = user.attendantCategory ?? token.attendantCategory;
        token.email = user.email ?? token.email;
        token.phone = user.phone ?? token.phone;
        token.sub = user.id ?? token.sub;
        token.isActive = user.isActive ?? token.isActive ?? true;
        token.isAgent = user.isAgent ?? token.isAgent ?? false;
        token.agentStatus = user.agentStatus ?? token.agentStatus ?? null;
        token.lastLoginMethod = user.lastLoginMethod ?? token.lastLoginMethod ?? null;
        return token;
      }

      if (!token.sub && !token.email) return token;
      // Avoid selecting `attendantCategory` directly because a DB enum mismatch
      // can cause Prisma to throw when reading the field. Fetch essential fields
      // and skip attendantCategory for now — this lets the jwt flow continue.
      try {
        const existing = await prisma.user.findFirst({
          where: token.sub ? { id: token.sub } : { email: token.email },
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            lastLoginMethod: true,
            agentProfile: { select: { id: true, status: true } },
          },
        });
        if (existing) {
          token.role = existing.role ?? token.role;
          token.email = existing.email ?? token.email;
          token.phone = existing.phone ?? token.phone;
          token.sub = existing.id ?? token.sub;
          token.isActive = existing.isActive ?? token.isActive ?? true;
          token.isAgent = Boolean(existing.agentProfile);
          token.agentStatus = existing.agentProfile?.status ?? null;
          token.lastLoginMethod = existing.lastLoginMethod ?? token.lastLoginMethod ?? null;
        }
      } catch (err) {
        console.error("nextAuth: safe user lookup failed:", err);
      }
      // Attempt to enrich token with `attendantCategory` using a raw query
      // that casts the DB enum to text. This avoids Prisma enum parsing
      // errors when the DB enum labels differ from the Prisma schema.
      try {
        const rows = token.sub
          ? (await prisma.$queryRaw`
              SELECT "attendantCategory"::text AS "attendantCategory"
              FROM "User"
              WHERE id = ${token.sub}
              LIMIT 1
            `) as Array<{ attendantCategory?: string | null }>
          : token.email
            ? (await prisma.$queryRaw`
                SELECT "attendantCategory"::text AS "attendantCategory"
                FROM "User"
                WHERE lower(email) = lower(${token.email})
                LIMIT 1
              `) as Array<{ attendantCategory?: string | null }>
            : [];
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
      (s.user as Record<string, unknown>).isAgent = token.isAgent ?? false;
      (s.user as Record<string, unknown>).agentStatus = token.agentStatus ?? null;
      (s.user as Record<string, unknown>).phone = token.phone ?? null;
      (s.user as Record<string, unknown>).lastLoginMethod = token.lastLoginMethod ?? null;
      return s;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);
        if (target.origin === baseUrl || isAllowedAuthOrigin(target.origin)) {
          return target.toString();
        }
      } catch {
        // Fall through to base URL when the redirect target is invalid.
      }

      return getAllowedAuthOrigins()[0] ?? baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
};

export default NextAuth;
