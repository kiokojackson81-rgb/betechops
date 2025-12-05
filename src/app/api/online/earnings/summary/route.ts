"use server";

import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getOnlineEarningsSummary } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const summary = await getOnlineEarningsSummary(auth.user.id);
  return NextResponse.json({ summary });
}
