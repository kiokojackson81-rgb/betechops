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
  // accept both all=true and shops=all (alias)
  const all = (url.searchParams.get("all") || "").toLowerCase() === "true" || (url.searchParams.get("shops") || "").toLowerCase() === "all";
  const shopId = (url.searchParams.get("shopId") || "").trim();
  const dryRun = (url.searchParams.get("dryRun") || "").toLowerCase() === "true";
  try {
    if (all) {
      const { aggregate } = await recomputeAllCounters();
      const payload = { ...rowToSummaryPayload(aggregate), updatedAt: new Date().toISOString() };
      return noStoreJson(payload);
    }
    if (!shopId) return NextResponse.json({ error: "shopId required (or set all=true)" }, { status: 400 });
    if (dryRun) {
      // Run compute without writing by skipping store call
      const row = await computeAndStoreCountersForShop(shopId).catch((e) => { throw e; });
      const payload = { ...rowToSummaryPayload(row), updatedAt: new Date().toISOString(), dryRun: true } as any;
      return noStoreJson(payload);
    }
    const row = await computeAndStoreCountersForShop(shopId);
    const payload = { ...rowToSummaryPayload(row), updatedAt: new Date().toISOString() };
    return noStoreJson(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
