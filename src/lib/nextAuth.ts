import NextAuth from "next-auth/next";
import type { Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getAllowedAuthOrigins, isAllowedAuthOrigin } from "@/lib/runtimeUrls";
import { readVerifiedPhoneToken } from "@/lib/phoneOtpAuth";
import { Prisma } from "@prisma/client";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import { PRODUCT_CONTRIBUTOR_EMAIL } from "@/lib/productContributorConfig";

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

const nextAuthOtpUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  attendantCategory: true,
  isActive: true,
  phone: true,
  lastLoginMethod: true,
  agentProfile: {
    select: {
      id: true,
      status: true,
      phone: true,
      email: true,
    },
  },
} as const;

async function resolveAgentProfileForAuth(args: {
  userId?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const normalizedPhone = normalizeKenyanPhone(args.phone || "");
  const phoneVariants = normalizedPhone ? getKenyanPhoneVariants(normalizedPhone) : [];
  const normalizedEmail = String(args.email || "").trim().toLowerCase();

  const agentProfile = await prisma.agentProfile.findFirst({
    where: {
      OR: [
        ...(args.userId ? [{ userId: args.userId }] : []),
        ...(phoneVariants.length ? [{ phone: { in: phoneVariants } }] : []),
        ...(normalizedPhone ? [{ user: { phone: normalizedPhone } }] : []),
        ...(normalizedEmail
          ? [
              { email: { equals: normalizedEmail, mode: "insensitive" as const } },
              { user: { email: { equals: normalizedEmail, mode: "insensitive" as const } } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      status: true,
      userId: true,
    },
  });

  console.log("[nextAuth] phone-otp resolved agent", {
    userId: args.userId ?? null,
    normalizedPhone,
    normalizedEmail: normalizedEmail || null,
    agentProfileId: agentProfile?.id ?? null,
    agentProfileUserId: agentProfile?.userId ?? null,
    agentStatus: agentProfile?.status ?? null,
  });

  return agentProfile;
}

function isMissingColumnError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";
}

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

        // Seed the dedicated catalogue contributor only when it first signs in.
        // Existing accounts are never changed here, including their password.
        if (email === PRODUCT_CONTRIBUTOR_EMAIL) {
          await prisma.user.upsert({
            where: { email },
            create: {
              email,
              name: "Twili Product Contributor",
              password: "$2b$12$MRXvUInWbL.uU82VIpfZpOjtbJsBmwJjzR/qdGlyN43fdvJNOV0Ve",
              role: "ATTENDANT",
              attendantCategory: "GENERAL_OPS",
              isActive: true,
            },
            update: {},
          });
        }

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
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        verificationToken: { label: "Phone verification token", type: "text" },
      },
      async authorize(credentials) {
        const verificationToken = String(credentials?.verificationToken || "").trim();
        if (!verificationToken) return null;

        const payload = readVerifiedPhoneToken(verificationToken);
        const resolved = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: nextAuthOtpUserSelect,
        });
        if (!resolved || !resolved.isActive) return null;

        const resolvedAgent = await resolveAgentProfileForAuth({
          userId: resolved.id,
          phone: payload.channel === "phone" ? payload.identifier : resolved.phone,
          email: payload.channel === "email" ? payload.identifier : resolved.email,
        });

        return {
          id: resolved.id,
          email: resolved.email ?? undefined,
          name: resolved.name,
          role: resolved.role,
          attendantCategory: resolved.attendantCategory ?? undefined,
          isActive: resolved.isActive,
          isAgent: Boolean(resolvedAgent ?? resolved.agentProfile),
          agentStatus: resolvedAgent?.status ?? resolved.agentProfile?.status ?? null,
          phone: resolved.phone ?? undefined,
          lastLoginMethod: resolved.lastLoginMethod ?? "africastalking_otp",
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
          const resolvedAgent = await resolveAgentProfileForAuth({
            userId: existing.id,
            phone: existing.phone ?? token.phone ?? null,
            email: existing.email ?? token.email ?? null,
          });
          token.role = existing.role ?? token.role;
          token.email = existing.email ?? token.email;
          token.phone = existing.phone ?? token.phone;
          token.sub = existing.id ?? token.sub;
          token.isActive = existing.isActive ?? token.isActive ?? true;
          token.isAgent = Boolean(resolvedAgent ?? existing.agentProfile);
          token.agentStatus = resolvedAgent?.status ?? existing.agentProfile?.status ?? null;
          token.lastLoginMethod = existing.lastLoginMethod ?? token.lastLoginMethod ?? null;
        }
      } catch (err) {
        console.error("nextAuth: safe user lookup failed:", err);
        if (isMissingColumnError(err)) {
          try {
            const fallback = await prisma.user.findFirst({
              where: token.sub ? { id: token.sub } : { email: token.email },
              select: {
                id: true,
                email: true,
                role: true,
                isActive: true,
                phone: true,
                agentProfile: { select: { id: true, status: true } },
              },
            });
            if (fallback) {
              const resolvedAgent = await resolveAgentProfileForAuth({
                userId: fallback.id,
                phone: fallback.phone ?? token.phone ?? null,
                email: fallback.email ?? token.email ?? null,
              });
              token.role = fallback.role ?? token.role;
              token.email = fallback.email ?? token.email;
              token.phone = fallback.phone ?? token.phone;
              token.sub = fallback.id ?? token.sub;
              token.isActive = fallback.isActive ?? token.isActive ?? true;
              token.isAgent = Boolean(resolvedAgent ?? fallback.agentProfile);
              token.agentStatus = resolvedAgent?.status ?? fallback.agentProfile?.status ?? null;
            }
          } catch (retryErr) {
            console.error("nextAuth: fallback user lookup failed:", retryErr);
          }
        }
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
