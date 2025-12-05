"use server";

import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getOnlineQuickStats } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const stats = await getOnlineQuickStats(auth.user.id);
  return NextResponse.json({ stats });
}
