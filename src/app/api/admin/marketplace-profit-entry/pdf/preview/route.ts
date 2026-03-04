import { NextRequest, NextResponse } from "next/server";
import { requireRoleOrBenjamin } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  return NextResponse.json(
    {
      error:
        "PDF parsing is not supported in this deployment environment. For Kilimall, please export and upload the Seller Center Excel (.xlsx) file instead.",
    },
    { status: 400 },
  );
}
