import { NextResponse } from "next/server";
import { requireRole, noStoreJson } from "@/lib/api";
import { computeAndStoreCountersForShop, recomputeAllCounters, rowToSummaryPayload } from "@/lib/catalog-counters";

// POST /api/admin/catalog/counters/recompute
// Query: all=true | shopId=<id>
// Recomputes exact counters and persists them. Returns the latest counters payload.
export async function POST(req: Request) {
  const authz = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!authz.ok) return authz.res;
  const url = new URL(req.url);
  const all = (url.searchParams.get("all") || "").toLowerCase() === "true";
  const shopId = (url.searchParams.get("shopId") || "").trim();
  try {
    if (all) {
      const { aggregate } = await recomputeAllCounters();
      const payload = { ...rowToSummaryPayload(aggregate), updatedAt: new Date().toISOString() };
      return noStoreJson(payload);
    }
    if (!shopId) return NextResponse.json({ error: "shopId required (or set all=true)" }, { status: 400 });
    const row = await computeAndStoreCountersForShop(shopId);
    const payload = { ...rowToSummaryPayload(row), updatedAt: new Date().toISOString() };
    return noStoreJson(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
