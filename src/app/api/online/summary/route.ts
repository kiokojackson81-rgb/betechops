import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  // Minimal online summary response used by admin pages. Implement fuller
  // behaviour as needed; placeholder ensures build-time types are satisfied.
  return NextResponse.json({ ok: true, summary: {} });
}
