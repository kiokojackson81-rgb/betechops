import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Small helper to return the server session in server components/pages.
 */
export async function auth() {
  return await getServerSession(authOptions as any);
}
// Simple auth helper for audit logging
export function getSession() {
  // For now, return a default session. This can be enhanced later with real auth
  return {
    id: "default-attendant",
    role: "attendant",
  };
}