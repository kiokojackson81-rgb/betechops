import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session: any = await getServerSession(authOptions as any);
  const cookieHeader = req.headers.get("cookie") ?? null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized", hasCookie: !!cookieHeader }, { status: 401 });
  }

  // Only return minimal session info to avoid leaking sensitive fields.
  const safeUser = {
    id: session.user?.id,
    email: session.user?.email,
    name: session.user?.name,
    role: session.user?.role,
  };

  return NextResponse.json({ user: safeUser, hasCookie: !!cookieHeader });
}
