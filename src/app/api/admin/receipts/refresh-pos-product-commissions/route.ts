import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { refreshPosProductCommissionsForPeriod } from "@/lib/refreshPosProductCommissions";

export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  try {
    const result = await refreshPosProductCommissionsForPeriod();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[admin/receipts/refresh-pos-product-commissions] failed", error);
    return NextResponse.json({ error: "Failed to refresh POS product commissions" }, { status: 500 });
  }
}
