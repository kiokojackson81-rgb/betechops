import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const s = await auth();
  const sess = s as unknown as { user?: { email?: string | null; role?: string | null } } | null;
  return NextResponse.json({ email: sess?.user?.email ?? null, role: sess?.user?.role ?? null });
}
