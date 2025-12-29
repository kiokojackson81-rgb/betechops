import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { runAdminSummaryJob } from "@/lib/adminSummaryJob";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const result = await runAdminSummaryJob({
    sendWhatsApp: false,
    advanceCutoff: false,
    useCutoff: true,
  });

  return NextResponse.json(result.payload);
}
