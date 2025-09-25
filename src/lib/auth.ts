import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/nextAuth";

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