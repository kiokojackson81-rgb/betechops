import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Small helper to return the server session in server components/pages.
 */
export async function auth(): Promise<Session | null> {
  return await getServerSession(authOptions);
}

// Simple auth helper for audit logging (placeholder until we wire real audit/session data)
export function getSession() {
  return {
    id: "default-attendant",
    role: "attendant",
  };
}