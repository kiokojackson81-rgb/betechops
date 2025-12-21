import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  // Return a small operational summary placeholder. The frontend callers
  // can handle empty/missing values; this file exists primarily so the
  // build has a concrete handler to type-check against.
  return NextResponse.json({ ok: true, message: "Online summary placeholder" });
}
