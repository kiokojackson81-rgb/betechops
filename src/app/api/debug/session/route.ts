import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/nextAuth";

export async function GET() {
  try {
  // The cast below is limited and intentional: authOptions shapes vary between
  // next-auth versions in different environments. We only use it to read the
  // runtime session in this debug endpoint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSession = (await getServerSession(authOptions as any)) as unknown;
    const adminEmail = process.env.ADMIN_EMAIL || null;
    let user: { email?: string; name?: string; role?: string } | null = null;
    if (rawSession && typeof rawSession === "object") {
      const maybe = rawSession as Record<string, unknown>;
      const u = maybe["user"] as unknown;
      if (u && typeof u === "object") {
        const uu = u as Record<string, unknown>;
        user = {
          email: typeof uu["email"] === "string" ? (uu["email"] as string) : undefined,
          name: typeof uu["name"] === "string" ? (uu["name"] as string) : undefined,
          role: typeof uu["role"] === "string" ? (uu["role"] as string) : undefined,
        };
      }
    }
    return NextResponse.json({ user, adminEmail });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
