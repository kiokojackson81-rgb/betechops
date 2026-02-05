import { cleanupDuplicatePayoutWeeks } from "@/lib/jobs/cleanupDuplicatePayoutWeeks";
import { requireRole } from "@/lib/api";
import { NextResponse } from "next/server";

async function handler(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  try {
    const result = await cleanupDuplicatePayoutWeeks();
    const res = NextResponse.json({ ok: true, result });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handler(request);
}

export async function GET(request: Request) {
  return handler(request);
}
