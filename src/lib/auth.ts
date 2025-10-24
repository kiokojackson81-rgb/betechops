import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/nextAuth";

// `NextAuthOptions` type may vary between next-auth versions; use a local alias
// to avoid accidental type imports that don't exist in some versions.

// ADMIN_EMAILS: comma-separated list of emails that should be treated as ADMIN
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "kiokojackson81@gmail.com")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Small helper to return the server session in server components/pages.
 */
export async function auth(): Promise<Session | null> {
  // next-auth types can vary between versions; cast to any in this narrow spot
  // to avoid build-time type incompatibilities while preserving runtime behavior.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await getServerSession(authOptions as any);
}

// Simple auth helper for audit logging (placeholder until we wire real audit/session data)
export function getSession() {
  return {
    id: "default-attendant",
    role: "attendant",
  };
}